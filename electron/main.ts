import { app, BrowserWindow, ipcMain, dialog, crashReporter, shell, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { parseM3U } from '../src/parser/m3u-parser';
import type { ParserResult } from '../src/types/channel';
import { RotatingLogger } from './logger';
import { StreamHealthScorer } from './stream-health';
import { StreamFallbackManager } from './stream-fallback';
import { RecordingManager } from './recording-manager';
import { EpgManager } from './epg-manager';
import { ProfileManager } from './profile-manager';

let mainWindow: BrowserWindow | null = null;
let vlcPlayer: any = null;
let logger: RotatingLogger | null = null;
let freezeCheckInterval: NodeJS.Timeout | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;
let restartAttempts = new Map<string, number>(); // Track restart attempts per URL
let healthScorer: StreamHealthScorer | null = null;
let fallbackManager: StreamFallbackManager | null = null;
let recordingManager: RecordingManager | null = null;
let epgManager: EpgManager | null = null;
let profileManager: ProfileManager | null = null;

/**
 * VLC Command Queue - Prevents race conditions and stale commands
 */
interface VlcCommand {
  id: number;
  type: 'play' | 'stop' | 'pause' | 'resume';
  url?: string;
  timestamp: number;
}

let commandSequence = 0;
let activeCommandId: number | null = null;
let pendingCommand: VlcCommand | null = null;
let isProcessingCommand = false;
let isShuttingDown = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const logPath = path.join(app.getPath('userData'), 'logs');
const crashDumpPath = path.join(app.getPath('userData'), 'crashes');
const recordingsPath = path.join(app.getPath('userData'), 'recordings');

// Initialize crash reporter for production
if (!isDev) {
  // Ensure crash dump directory exists
  if (!fs.existsSync(crashDumpPath)) {
    fs.mkdirSync(crashDumpPath, { recursive: true });
  }
  
  crashReporter.start({
    productName: 'JPTV Player',
    companyName: 'JPTV',
    submitURL: '', // No remote submission, local storage only
    uploadToServer: false,
    compress: true,
    extra: {
      version: app.getVersion(),
      platform: process.platform
    }
  });
  
  console.log('[Crash Reporter] Initialized. Dumps stored at:', crashDumpPath);
}

const MAX_RESTART_ATTEMPTS = 1;
const FREEZE_CHECK_INTERVAL = 5000; // Check every 5 seconds
const FREEZE_THRESHOLD = 10; // Consider frozen after 10 seconds
const HEALTH_CHECK_INTERVAL = 3000; // Collect stats every 3 seconds

/**
 * Process VLC command queue - ensures only one command executes at a time
 */
async function processVlcCommand(command: VlcCommand): Promise<boolean> {
  if (isShuttingDown) {
    logger?.warn('Command rejected: app is shutting down', { command: command.type });
    return false;
  }

  // Ignore stale commands (older pending command superseded by newer one)
  if (pendingCommand && pendingCommand.id !== command.id) {
    logger?.info('Ignoring stale command', { 
      staleId: command.id, 
      activeId: pendingCommand.id,
      type: command.type 
    });
    return false;
  }

  if (isProcessingCommand) {
    logger?.warn('Command already processing, queuing', { type: command.type });
    pendingCommand = command;
    return false;
  }

  isProcessingCommand = true;
  activeCommandId = command.id;

  try {
    logger?.info('Processing VLC command', { id: command.id, type: command.type });

    let success = false;
    switch (command.type) {
      case 'play':
        if (command.url && vlcPlayer) {
          // Stop current playback first
          try {
            vlcPlayer.stop();
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (e) {
            logger?.warn('Stop before play failed', { error: e });
          }
          success = vlcPlayer.play(command.url);
        }
        break;
      case 'stop':
        if (vlcPlayer) {
          success = vlcPlayer.stop();
        }
        break;
      case 'pause':
        if (vlcPlayer) {
          success = vlcPlayer.pause();
        }
        break;
      case 'resume':
        if (vlcPlayer) {
          success = vlcPlayer.resume();
        }
        break;
    }

    return success;
  } finally {
    isProcessingCommand = false;
    activeCommandId = null;

    // Process next pending command if any
    if (pendingCommand) {
      const next = pendingCommand;
      pendingCommand = null;
      setTimeout(() => processVlcCommand(next), 50);
    }
  }
}

/**
 * Queue a VLC command with sequence ID
 */
function queueVlcCommand(type: VlcCommand['type'], url?: string): number {
  const commandId = ++commandSequence;
  const command: VlcCommand = {
    id: commandId,
    type,
    url,
    timestamp: Date.now()
  };

  processVlcCommand(command);
  return commandId;
}

interface AppSettings {
  lastPlaylist?: string;
  lastChannelId?: string;
  lastChannelIndex?: number;
  channelHistory: string[];
  favorites: number[];
  volume: number;
}

const defaultSettings: AppSettings = {
  channelHistory: [],
  favorites: [],
  volume: 50
};

function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return defaultSettings;
}

function saveSettings(settings: AppSettings): void {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDev // Disable DevTools in production
    },
    autoHideMenuBar: true,
    frame: false,           // Borderless window for TV mode
    fullscreen: !isDev,     // Start fullscreen in production (TV mode)
    show: false             // Don't show until ready (prevents flash)
  });

  // Create application menu
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Playlist',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu:openPlaylist');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Donate',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            mainWindow?.webContents.send('menu:openDonation');
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About JPTV Player',
              message: 'JPTV Player',
              detail: `Version: ${app.getVersion()}\\nElectron IPTV Player with VLC backend`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Show window once content is loaded (prevents flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Initialize VLC player after window is ready
  mainWindow.webContents.once('did-finish-load', () => {
    initializeVlcPlayer();
  });
}

// Handle fullscreen toggle
ipcMain.handle('window:toggleFullscreen', async () => {
  if (!mainWindow) return false;
  
  const isFullscreen = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFullscreen);
  return !isFullscreen;
});

ipcMain.handle('window:setFullscreen', async (_, fullscreen: boolean) => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(fullscreen);
});

ipcMain.handle('window:isFullscreen', async () => {
  return mainWindow?.isFullScreen() || false;
});

/**
 * Initialize VLC native addon and freeze detection
 */
function initializeVlcPlayer() {
  try {
    // Initialize logger
    logger = new RotatingLogger(logPath);
    logger.info('Initializing VLC player');

    // Set VLC plugin path for bundled runtime in production
    if (!isDev) {
      const vlcPath = path.join(process.resourcesPath, 'vlc');
      const pluginPath = path.join(vlcPath, 'plugins');
      
      if (fs.existsSync(vlcPath)) {
        process.env.VLC_PLUGIN_PATH = pluginPath;
        logger?.info('Using bundled VLC runtime', { vlcPath, pluginPath });
        console.log('[VLC] Using bundled VLC runtime:', vlcPath);
      } else {
        logger?.warn('Bundled VLC not found, falling back to system VLC', { vlcPath });
        console.warn('[VLC] Bundled VLC not found at:', vlcPath);
      }
    }

    // Load native VLC addon
    const addonPath = path.join(__dirname, '../build/Release/vlc_player.node');
    
    if (!fs.existsSync(addonPath)) {
      const error = 'Native addon not found';
      logger?.error(error, { path: addonPath });
      console.error('[VLC] Native addon not found at:', addonPath);
      console.error('[VLC] Run "npm run build:native" to compile the addon');
      return;
    }

    vlcPlayer = require(addonPath);

    if (mainWindow) {
      // Get HWND from BrowserWindow
      const hwnd = mainWindow.getNativeWindowHandle();
      const hwndValue = hwnd.readBigInt64LE(0);
      
      const success = vlcPlayer.initialize(hwndValue);
      if (success) {
        logger?.info('Player initialized successfully');
        console.log('[VLC] Player initialized successfully');
        
        // Initialize managers
        healthScorer = new StreamHealthScorer();
        fallbackManager = new StreamFallbackManager(logger!);
        recordingManager = new RecordingManager(recordingsPath, logger!);
        epgManager = new EpgManager(app.getPath('userData'));
        profileManager = new ProfileManager(app.getPath('userData'));
        
        // Initialize EPG data (from cache if available)
        epgManager.initialize().catch(err => {
          logger?.error('EPG initialization failed', { error: err });
        });
        
        // Initialize profile system
        profileManager.initialize().catch(err => {
          logger?.error('Profile system initialization failed', { error: err });
        });
        
        startFreezeDetection();
        startHealthMonitoring();
      } else {
        logger?.error('Failed to initialize player');
        console.error('[VLC] Failed to initialize player');
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger?.error('Failed to load native addon', { error: errorMsg });
    console.error('[VLC] Failed to load native addon:', error);
    console.error('[VLC] Make sure VLC is installed and the addon is compiled');
  }
}

/**
 * Start periodic freeze detection
 */
function startFreezeDetection() {
  if (freezeCheckInterval) {
    clearInterval(freezeCheckInterval);
  }

  freezeCheckInterval = setInterval(() => {
    if (!vlcPlayer) return;

    try {
      // Update frame time
      vlcPlayer.updateFrameTime();

      // Check if stream is frozen
      const frozen = vlcPlayer.isStreamFrozen(FREEZE_THRESHOLD);
      
      if (frozen) {
        const currentUrl = vlcPlayer.getCurrentUrl();
        if (currentUrl) {
          logger?.warn('Stream freeze detected', { url: currentUrl });
          handleStreamFreeze(currentUrl);
        }
      }
    } catch (error) {
      logger?.error('Error during freeze detection', { error });
    }
  }, FREEZE_CHECK_INTERVAL);
}

/**
 * Start periodic health monitoring (stats collection)
 */
function startHealthMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  healthCheckInterval = setInterval(() => {
    if (!vlcPlayer || !healthScorer) return;

    try {
      // Only collect stats if playing
      const isPlaying = vlcPlayer.isPlaying();
      if (!isPlaying) return;

      // Get current URL (used as channel identifier)
      const currentUrl = vlcPlayer.getCurrentUrl();
      if (!currentUrl) return;

      // Get VLC statistics
      const stats = vlcPlayer.getStats();
      
      // Update health scorer
      healthScorer.updateStats(currentUrl, {
        ...stats,
        timestamp: Date.now()
      });

      logger?.debug('Health stats collected', { 
        url: currentUrl, 
        bitrate: stats.inputBitrate 
      });
    } catch (error) {
      logger?.error('Error during health monitoring', { error });
    }
  }, HEALTH_CHECK_INTERVAL);
}

/**
 * Handle frozen stream with auto-restart
 */
async function handleStreamFreeze(url: string) {
  if (!vlcPlayer) return;

  try {
    const attempts = restartAttempts.get(url) || 0;

    if (attempts < MAX_RESTART_ATTEMPTS) {
      logger?.info('Attempting auto-restart', { url, attempt: attempts + 1 });
      
      // Stop current playback
      vlcPlayer.stop();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Try to restart
      const success = vlcPlayer.play(url);
      
      if (success) {
        restartAttempts.set(url, attempts + 1);
        logger?.info('Stream restarted successfully', { url });
      } else {
        logger?.error('Stream restart failed', { url });
        restartAttempts.delete(url);
        
        // Notify renderer of failure
        if (mainWindow) {
          mainWindow.webContents.send('player:error', {
            message: 'Stream restart failed',
            url
          });
        }
      }
    } else {
      logger?.error('Max restart attempts reached', { url, attempts });
      restartAttempts.delete(url);
      
      // Notify renderer of persistent failure
      if (mainWindow) {
        mainWindow.webContents.send('player:error', {
          message: 'Playback failed after restart attempt',
          url
        });
      }
    }
  } catch (error) {
    logger?.error('Error handling stream freeze', { url, error });
  }
}

/**
 * Safely recreate media player after crash
 */
async function safeRecreatePlayer(): Promise<boolean> {
  if (!vlcPlayer) return false;

  try {
    logger?.warn('Attempting to recreate media player');
    const success = vlcPlayer.recreateMediaPlayer();
    
    if (success) {
      logger?.info('Media player recreated successfully');
      return true;
    } else {
      logger?.error('Failed to recreate media player');
      return false;
    }
  } catch (error) {
    logger?.error('Error recreating media player', { error });
    return false;
  }
}

// IPC Handlers
ipcMain.handle('dialog:openPlaylist', async () => {
  if (!mainWindow) return null;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Playlist Files', extensions: ['m3u', 'm3u8'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parseResult: ParserResult = parseM3U(content);
    
    if (!parseResult.success) {
      console.error('Failed to parse playlist:', parseResult.error);
      return {
        path: filePath,
        content,
        parseResult
      };
    }

    // Convert Map to plain object for IPC serialization
    const categoriesObj: Record<string, any[]> = {};
    if (parseResult.data?.categories) {
      for (const [key, value] of parseResult.data.categories) {
        categoriesObj[key] = value;
      }
    }

    return {
      path: filePath,
      content,
      parseResult: {
        ...parseResult,
        data: parseResult.data ? {
          channels: parseResult.data.channels,
          categories: categoriesObj
        } : undefined
      }
    };
  } catch (error) {
    console.error('Failed to read playlist:', error);
    return {
      path: filePath,
      content: '',
      parseResult: {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file'
      }
    };
  }
});

ipcMain.handle('settings:load', () => {
  return loadSettings();
});

ipcMain.handle('settings:save', (_event, settings: AppSettings) => {
  saveSettings(settings);
  return true;
});

ipcMain.handle('settings:get', (_event, key: keyof AppSettings) => {
  const settings = loadSettings();
  return settings[key];
});

ipcMain.handle('settings:set', (_event, key: keyof AppSettings, value: any) => {
  const settings = loadSettings();
  (settings as any)[key] = value;
  saveSettings(settings);
  return true;
});

// File reading handler for EPG/XMLTV files
ipcMain.handle('file:read', async (_event, filePath: string) => {
  try {
    logger?.debug('Reading file', { filePath });
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    logger?.error('Failed to read file', { filePath, error });
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Player IPC Handlers with crash protection
ipcMain.handle('player:play', async (_event, url: string) => {
  if (!vlcPlayer) {
    logger?.error('Play called but VLC not initialized');
    return { success: false, error: 'VLC player not initialized' };
  }

  if (isShuttingDown) {
    logger?.warn('Play rejected: app shutting down');
    return { success: false, error: 'App is shutting down' };
  }

  try {
    logger?.info('Play requested', { url });
    
    // Reset restart attempts for new URL
    restartAttempts.delete(url);
    
    // Check if player is in error state
    const inError = vlcPlayer.isInError();
    if (inError) {
      logger?.warn('Player in error state, attempting recreation');
      const recreated = await safeRecreatePlayer();
      if (!recreated) {
        logger?.error('Failed to recreate player');
        return { success: false, error: 'Player in error state and recreation failed' };
      }
    }

    // Queue the play command (prevents race conditions)
    queueVlcCommand('play', url);
    
    // Give VLC time to start
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Check if playback started
    const isPlaying = vlcPlayer.isPlaying();
    
    if (isPlaying) {
      logger?.info('Playback started', { url });
    } else {
      logger?.error('Playback failed', { url });
    }
    
    return { success: isPlaying, error: isPlaying ? undefined : 'Failed to play stream' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown playback error';
    logger?.error('Play error', { url, error: errorMsg });
    console.error('[VLC] Play error:', error);
    
    // Try to recover
    try {
      await safeRecreatePlayer();
    } catch (recoveryError) {
      logger?.error('Recovery failed', { error: recoveryError });
    }
    
    return { 
      success: false, 
      error: errorMsg
    };
  }
});

ipcMain.handle('player:stop', async () => {
  if (!vlcPlayer) {
    return { success: false };
  }

  try {
    logger?.info('Stop requested');
    const currentUrl = vlcPlayer.getCurrentUrl();
    
    // Queue stop command
    queueVlcCommand('stop');
    
    // Give VLC time to stop
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (currentUrl) {
      // Clear restart attempts when user manually stops
      restartAttempts.delete(currentUrl);
      logger?.info('Playback stopped', { url: currentUrl });
    }
    
    return { success: true };
  } catch (error) {
    logger?.error('Stop error', { error });
    console.error('[VLC] Stop error:', error);
    return { success: false };
  }
});

ipcMain.handle('player:pause', async () => {
  if (!vlcPlayer) {
    return { success: false };
  }

  if (isShuttingDown) {
    return { success: false, error: 'App is shutting down' };
  }

  try {
    logger?.debug('Pause requested');
    queueVlcCommand('pause');
    await new Promise(resolve => setTimeout(resolve, 50));
    return { success: true };
  } catch (error) {
    logger?.error('Pause error', { error });
    console.error('[VLC] Pause error:', error);
    return { success: false };
  }
});

ipcMain.handle('player:resume', async () => {
  if (!vlcPlayer) {
    return { success: false };
  }

  if (isShuttingDown) {
    return { success: false, error: 'App is shutting down' };
  }

  try {
    logger?.debug('Resume requested');
    queueVlcCommand('resume');
    await new Promise(resolve => setTimeout(resolve, 50));
    return { success: true };
  } catch (error) {
    logger?.error('Resume error', { error });
    console.error('[VLC] Resume error:', error);
    return { success: false };
  }
});

ipcMain.handle('player:setVolume', async (_event, volume: number) => {
  if (!vlcPlayer) {
    return { success: false };
  }

  try {
    const success = vlcPlayer.setVolume(volume);
    return { success };
  } catch (error) {
    logger?.error('SetVolume error', { volume, error });
    console.error('[VLC] SetVolume error:', error);
    return { success: false };
  }
});

ipcMain.handle('player:getVolume', async () => {
  if (!vlcPlayer) {
    return { volume: 50 };
  }

  try {
    const volume = vlcPlayer.getVolume();
    return { volume };
  } catch (error) {
    logger?.error('GetVolume error', { error });
    console.error('[VLC] GetVolume error:', error);
    return { volume: 50 };
  }
});

ipcMain.handle('player:getState', async () => {
  if (!vlcPlayer) {
    return { state: 'stopped' };
  }

  try {
    const state = vlcPlayer.getState();
    return { state };
  } catch (error) {
    logger?.error('GetState error', { error });
    console.error('[VLC] GetState error:', error);
    return { state: 'error' };
  }
});

ipcMain.handle('player:isPlaying', async () => {
  if (!vlcPlayer) {
    return { playing: false };
  }

  try {
    const playing = vlcPlayer.isPlaying();
    return { playing };
  } catch (error) {
    logger?.error('IsPlaying error', { error });
    console.error('[VLC] IsPlaying error:', error);
    return { playing: false };
  }
});

// Health score IPC handlers
ipcMain.handle('health:getScore', async (_event, channelId: string) => {
  if (!healthScorer) {
    return null;
  }

  try {
    return healthScorer.getHealthScore(channelId);
  } catch (error) {
    logger?.error('GetHealthScore error', { error, channelId });
    return null;
  }
});

ipcMain.handle('health:getAllScores', async () => {
  if (!healthScorer) {
    return [];
  }

  try {
    return healthScorer.getAllHealth();
  } catch (error) {
    logger?.error('GetAllHealthScores error', { error });
    return [];
  }
});

ipcMain.handle('health:clear', async (_event, channelId?: string) => {
  if (!healthScorer) {
    return;
  }

  try {
    if (channelId) {
      healthScorer.clearChannel(channelId);
    } else {
      healthScorer.clearAll();
    }
  } catch (error) {
    logger?.error('ClearHealth error', { error, channelId });
  }
});

// Fallback IPC handlers
ipcMain.handle('player:playWithFallback', async (_event, channelId: string, urls: string[], lastSuccessfulUrl?: string) => {
  if (!vlcPlayer || !fallbackManager) {
    logger?.error('PlayWithFallback called but VLC or fallback manager not initialized');
    return { success: false, error: 'Player not initialized' };
  }

  try {
    // Initialize fallback state
    fallbackManager.initializeChannel(channelId, urls, lastSuccessfulUrl);
    
    // Get first URL to try
    const url = fallbackManager.getCurrentUrl(channelId);
    if (!url) {
      logger?.error('No URL available for channel', { channelId });
      return { success: false, error: 'No URL available' };
    }

    logger?.info('Starting playback with fallback', { channelId, url, urlCount: urls.length });

    // Reset restart attempts
    restartAttempts.delete(url);

    // Check if player is in error state
    const inError = vlcPlayer.isInError();
    if (inError) {
      logger?.warn('Player in error state, attempting recreation');
      const recreated = await safeRecreatePlayer();
      if (!recreated) {
        logger?.error('Failed to recreate player');
        return { success: false, error: 'Player in error state' };
      }
    }

    // Try to play
    const success = vlcPlayer.play(url);
    
    if (success) {
      fallbackManager.markSuccess(channelId);
      logger?.info('Playback started successfully', { channelId, url });
      return { success: true, url };
    } else {
      // Try next URL
      logger?.warn('Initial playback failed, trying fallback', { channelId, url });
      return await tryNextFallbackUrl(channelId);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger?.error('PlayWithFallback error', { channelId, error: errorMsg });
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('player:retryFallback', async (_event, channelId: string) => {
  if (!fallbackManager) {
    return { success: false, error: 'Fallback manager not initialized' };
  }

  try {
    return await tryNextFallbackUrl(channelId);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger?.error('RetryFallback error', { channelId, error: errorMsg });
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('player:getLastSuccessfulUrl', async (_event, channelId: string) => {
  if (!fallbackManager) {
    return null;
  }
  return fallbackManager.getLastSuccessfulUrl(channelId);
});

/**
 * Try next fallback URL for a channel
 */
async function tryNextFallbackUrl(channelId: string): Promise<{ success: boolean; error?: string; url?: string }> {
  if (!vlcPlayer || !fallbackManager) {
    return { success: false, error: 'Player or fallback manager not available' };
  }

  const nextUrl = fallbackManager.markFailureAndGetNext(channelId);
  
  if (!nextUrl) {
    logger?.error('All URLs failed for channel', { channelId });
    return { success: false, error: 'All URLs failed' };
  }

  logger?.info('Trying fallback URL', { channelId, url: nextUrl });

  // Stop current playback
  try {
    vlcPlayer.stop();
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (error) {
    logger?.warn('Error stopping playback', { error });
  }

  // Check if player needs recreation
  const inError = vlcPlayer.isInError();
  if (inError) {
    const recreated = await safeRecreatePlayer();
    if (!recreated) {
      return { success: false, error: 'Player recreation failed' };
    }
  }

  // Try to play next URL
  const success = vlcPlayer.play(nextUrl);
  
  if (success) {
    fallbackManager.markSuccess(channelId);
    logger?.info('Fallback URL successful', { channelId, url: nextUrl });
    return { success: true, url: nextUrl };
  } else {
    logger?.warn('Fallback URL failed', { channelId, url: nextUrl });
    
    // Check if more URLs available
    if (fallbackManager.hasMoreUrls(channelId)) {
      // Recursively try next URL
      return await tryNextFallbackUrl(channelId);
    } else {
      return { success: false, error: 'All URLs exhausted' };
    }
  }
}

// Recording IPC handlers
ipcMain.handle('recording:start', async (_event, channelId: string, channelName: string) => {
  if (!vlcPlayer || !recordingManager) {
    logger?.error('Recording start called but not initialized');
    return { success: false, error: 'Recording not available' };
  }

  try {
    // Generate file path
    const filePath = recordingManager.startRecording(channelId, channelName);
    
    // Start recording via VLC
    const success = vlcPlayer.startRecording(filePath);
    
    if (success) {
      logger?.info('Recording started successfully', { channelId, channelName, filePath });
      return { success: true, filePath };
    } else {
      recordingManager.stopRecording(channelId);
      logger?.error('VLC recording failed to start', { channelId });
      return { success: false, error: 'Failed to start VLC recording' };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger?.error('Recording start error', { channelId, error: errorMsg });
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('recording:stop', async (_event, channelId: string) => {
  if (!vlcPlayer || !recordingManager) {
    return { success: false, error: 'Recording not available' };
  }

  try {
    // Stop VLC recording
    const vlcStopped = vlcPlayer.stopRecording();
    
    // Update recording manager
    const managerStopped = recordingManager.stopRecording(channelId);
    
    if (vlcStopped && managerStopped) {
      logger?.info('Recording stopped successfully', { channelId });
      return { success: true };
    } else {
      logger?.warn('Recording stop incomplete', { channelId, vlcStopped, managerStopped });
      return { success: false, error: 'Stop incomplete' };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger?.error('Recording stop error', { channelId, error: errorMsg });
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('recording:isRecording', async (_event, channelId?: string) => {
  if (!vlcPlayer || !recordingManager) {
    return false;
  }

  try {
    if (channelId) {
      return recordingManager.isRecording(channelId);
    } else {
      // Check VLC player state
      return vlcPlayer.isRecording();
    }
  } catch (error) {
    logger?.error('IsRecording check error', { error });
    return false;
  }
});

ipcMain.handle('recording:getInfo', async (_event, channelId: string) => {
  if (!recordingManager) {
    return null;
  }

  try {
    return recordingManager.getRecordingInfo(channelId);
  } catch (error) {
    logger?.error('GetRecordingInfo error', { error });
    return null;
  }
});

ipcMain.handle('recording:getActive', async () => {
  if (!recordingManager) {
    return [];
  }

  try {
    return recordingManager.getActiveRecordings();
  } catch (error) {
    logger?.error('GetActiveRecordings error', { error });
    return [];
  }
});

ipcMain.handle('recording:getPath', async () => {
  if (!recordingManager) {
    return '';
  }

  return recordingManager.getRecordingsPath();
});

// Audio-only mode handlers (disabled - requires VLC SDK rebuild)
/*
ipcMain.handle('player:setAudioOnly', async (_event, enabled: boolean) => {
  if (!vlcPlayer) {
    return { success: false, error: 'VLC player not initialized' };
  }

  try {
    logger?.info('SetAudioOnly', { enabled });
    const success = vlcPlayer.setAudioOnly(enabled);
    
    if (success) {
      logger?.info('Audio-only mode changed', { enabled });
    }
    
    return { success };
  } catch (error) {
    logger?.error('SetAudioOnly error', { error });
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('player:getAudioOnly', async () => {
  if (!vlcPlayer) {
    return false;
  }

  try {
    return vlcPlayer.getAudioOnly();
  } catch (error) {
    logger?.error('GetAudioOnly error', { error });
    return false;
  }
});
*/

// Audio normalization IPC handlers
ipcMain.handle('vlc:getAudioLevel', async () => {
  if (!vlcPlayer) {
    logger?.warn('VLC player not initialized for getAudioLevel');
    return -96; // Return very low level if player not available
  }

  try {
    // Get current audio volume as a proxy for level
    // In a real implementation, this would use VLC's audio meter
    const volume = vlcPlayer.getVolume();
    // Convert volume (0-100) to dB approximation
    // Rough conversion: 0 = -96dB, 50 = -23dB (LUFS target), 100 = 0dB
    const db = volume === 0 ? -96 : (volume / 100) * 96 - 96;
    return db;
  } catch (error) {
    logger?.error('GetAudioLevel error', { error });
    return -96;
  }
});

ipcMain.handle('vlc:setAudioGain', async (_event, gainDb: number) => {
  if (!vlcPlayer) {
    logger?.warn('VLC player not initialized for setAudioGain');
    return;
  }

  try {
    // Convert dB gain to volume adjustment
    // This is a simplified approach - real implementation would use VLC's audio filters
    // Current volume is the baseline, we adjust relative to it
    const currentVolume = vlcPlayer.getVolume();
    
    // Convert gain (dB) to linear scale factor
    // 6 dB = 2x, -6 dB = 0.5x
    const linearGain = Math.pow(10, gainDb / 20);
    
    // Apply gain, clamping to valid range
    const newVolume = Math.max(0, Math.min(100, currentVolume * linearGain));
    
    vlcPlayer.setVolume(newVolume);
    logger?.info('Applied audio gain', { gainDb, currentVolume, newVolume });
  } catch (error) {
    logger?.error('SetAudioGain error', { error });
  }
});

// EPG IPC handlers
ipcMain.handle('epg:loadXmltv', async (_event, filePath: string) => {
  if (!epgManager) {
    logger?.warn('EPG manager not initialized');
    return { success: false, error: 'EPG manager not initialized' };
  }

  try {
    logger?.info('Loading XMLTV file', { filePath });
    const result = await epgManager.loadFromXmltv(filePath);
    return result;
  } catch (error) {
    logger?.error('Failed to load XMLTV', { error });
    return {
      success: false,
      channels: new Map(),
      programs: new Map(),
      channelCount: 0,
      programCount: 0,
      parseTime: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

ipcMain.handle('epg:openXmltvFile', async () => {
  if (!mainWindow) {
    return null;
  }

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select XMLTV File',
      filters: [
        { name: 'XMLTV Files', extensions: ['xml', 'xmltv'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    logger?.info('XMLTV file selected', { filePath });

    // Load the file
    if (epgManager) {
      const parseResult = await epgManager.loadFromXmltv(filePath);
      return { filePath, parseResult };
    }

    return null;
  } catch (error) {
    logger?.error('Failed to open XMLTV file', { error });
    return null;
  }
});

ipcMain.handle('epg:getNowNext', async (_event, channelId: string) => {
  if (!epgManager) {
    return { now: null, next: null, progress: 0 };
  }

  try {
    return epgManager.getNowNext(channelId);
  } catch (error) {
    logger?.error('Failed to get now/next', { error, channelId });
    return { now: null, next: null, progress: 0 };
  }
});

ipcMain.handle('epg:getGuideWindow', async (_event, channelIds: string[], startTime: number, endTime: number) => {
  if (!epgManager) {
    return { startTime, endTime, channels: [] };
  }

  try {
    return epgManager.getGuideWindow(channelIds, startTime, endTime);
  } catch (error) {
    logger?.error('Failed to get guide window', { error });
    return { startTime, endTime, channels: [] };
  }
});

ipcMain.handle('epg:getProgramsForDate', async (_event, channelId: string, dateStr: string) => {
  if (!epgManager) {
    return [];
  }

  try {
    const date = new Date(dateStr);
    return epgManager.getProgramsForDate(channelId, date);
  } catch (error) {
    logger?.error('Failed to get programs for date', { error, channelId, dateStr });
    return [];
  }
});

ipcMain.handle('epg:getChannel', async (_event, channelId: string) => {
  if (!epgManager) {
    return null;
  }

  try {
    return epgManager.getChannel(channelId) || null;
  } catch (error) {
    logger?.error('Failed to get channel', { error, channelId });
    return null;
  }
});

ipcMain.handle('epg:getAllChannels', async () => {
  if (!epgManager) {
    return [];
  }

  try {
    return epgManager.getAllChannels();
  } catch (error) {
    logger?.error('Failed to get all channels', { error });
    return [];
  }
});

ipcMain.handle('epg:getStats', async () => {
  if (!epgManager) {
    return { channels: 0, totalPrograms: 0, isLoaded: false };
  }

  try {
    return epgManager.getStats();
  } catch (error) {
    logger?.error('Failed to get EPG stats', { error });
    return { channels: 0, totalPrograms: 0, isLoaded: false };
  }
});

ipcMain.handle('epg:clear', async () => {
  if (!epgManager) {
    return;
  }

  try {
    epgManager.clear();
    logger?.info('EPG data cleared');
  } catch (error) {
    logger?.error('Failed to clear EPG', { error });
  }
});

// ========== Profile IPC Handlers ==========

ipcMain.handle('profile:list', async () => {
  if (!profileManager) {
    throw new Error('Profile manager not initialized');
  }

  try {
    return profileManager.listProfiles();
  } catch (error) {
    logger?.error('Failed to list profiles', { error });
    throw error;
  }
});

ipcMain.handle('profile:create', async (_event, request) => {
  if (!profileManager) {
    throw new Error('Profile manager not initialized');
  }

  try {
    const profile = await profileManager.createProfile(request);
    logger?.info('Profile created', { profileId: profile.id, name: profile.name });
    return profile;
  } catch (error) {
    logger?.error('Failed to create profile', { error, request });
    throw error;
  }
});

ipcMain.handle('profile:delete', async (_event, profileId: string) => {
  if (!profileManager) {
    throw new Error('Profile manager not initialized');
  }

  try {
    await profileManager.deleteProfile(profileId);
    logger?.info('Profile deleted', { profileId });
  } catch (error) {
    logger?.error('Failed to delete profile', { error, profileId });
    throw error;
  }
});

ipcMain.handle('profile:login', async (_event, request) => {
  if (!profileManager) {
    throw new Error('Profile manager not initialized');
  }

  try {
    const session = await profileManager.login(request);
    logger?.info('Profile logged in', { profileId: session.profile.id, name: session.profile.name });
    return session;
  } catch (error) {
    logger?.error('Failed to login', { error, profileId: request.profileId });
    throw error;
  }
});

ipcMain.handle('profile:logout', async () => {
  if (!profileManager) {
    throw new Error('Profile manager not initialized');
  }

  try {
    profileManager.logout();
    logger?.info('Profile logged out');
  } catch (error) {
    logger?.error('Failed to logout', { error });
    throw error;
  }
});

ipcMain.handle('profile:getActive', async () => {
  if (!profileManager) {
    throw new Error('Profile manager not initialized');
  }

  return profileManager.getActiveSession();
});

ipcMain.handle('profile:getLastActive', async () => {
  if (!profileManager) {
    throw new Error('Profile manager not initialized');
  }

  return profileManager.getLastActiveProfileId();
});

ipcMain.handle('profile:updateData', async (_event, data) => {
  if (!profileManager) {
    throw new Error('Profile manager not initialized');
  }

  try {
    profileManager.updateActiveProfileData(data);
    logger?.info('Profile data updated');
  } catch (error) {
    logger?.error('Failed to update profile data', { error });
    throw error;
  }
});

ipcMain.handle('profile:save', async () => {
  if (!profileManager) {
    throw new Error('Profile manager not initialized');
  }

  try {
    profileManager.saveActiveProfile();
    logger?.info('Profile data saved');
  } catch (error) {
    logger?.error('Failed to save profile data', { error });
    throw error;
  }
});

ipcMain.handle('profile:verifyPin', async (_, profileId: string, pin: string) => {
  if (!profileManager) {
    throw new Error('Profile manager not initialized');
  }

  try {
    const isValid = await profileManager.verifyPin(profileId, pin);
    logger?.info('PIN verification', { profileId, result: isValid });
    return isValid;
  } catch (error) {
    logger?.error('PIN verification failed', { error });
    throw error;
  }
});

// Shell handler for opening external links
/**
 * Force stop VLC synchronously - used during shutdown
 */
function forceStopVlc(): void {
  if (!vlcPlayer) return;

  try {
    logger?.info('Force stopping VLC');
    vlcPlayer.stop();
    
    // Give VLC a moment to cleanup
    const start = Date.now();
    while (Date.now() - start < 500) {
      // Busy wait (synchronous)
      if (!vlcPlayer.isPlaying()) break;
    }
    
    logger?.info('VLC stopped');
  } catch (error) {
    logger?.error('Force stop VLC failed', { error });
  }
}

/**
 * Check for and cleanup orphaned VLC processes
 */
function cleanupOrphanedVlcProcesses(): void {
  if (process.platform !== 'win32') return;

  try {
    const { execSync } = require('child_process');
    // Check for VLC processes not owned by current app
    const result = execSync('tasklist /FI "IMAGENAME eq vlc.exe" /FO CSV /NH', { encoding: 'utf8' });
    
    if (result.includes('vlc.exe')) {
      logger?.warn('Found potentially orphaned VLC processes', { processes: result.trim() });
      // Note: We don't force-kill here as they might be legitimate VLC instances
      // This is logged for diagnostic purposes
    }
  } catch (error) {
    // Silently fail - this is a best-effort cleanup check
  }
}

ipcMain.handle('shell:openExternal', async (_, url: string) => {
  try {
    logger?.info('Opening external URL', { url });
    await shell.openExternal(url);
  } catch (error) {
    logger?.error('Failed to open external URL', { error, url });
    throw error;
  }
});

app.whenReady().then(() => {
  // Check for orphaned VLC processes on startup
  cleanupOrphanedVlcProcesses();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Blocking shutdown handler - ensures clean VLC stop and profile save
app.on('before-quit', (event) => {
  if (isShuttingDown) return;

  event.preventDefault();
  isShuttingDown = true;

  logger?.info('Before-quit: Starting clean shutdown');

  // 1. Stop VLC immediately (synchronous)
  forceStopVlc();

  // 2. Clear all intervals
  if (freezeCheckInterval) {
    clearInterval(freezeCheckInterval);
    freezeCheckInterval = null;
  }
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // 3. Save active profile (synchronous)
  if (profileManager) {
    try {
      profileManager.saveActiveProfile();
      logger?.info('Profile saved during shutdown');
    } catch (error) {
      logger?.error('Failed to save profile during shutdown', { error });
    }
  }

  // 4. Flush logger (if method exists)
  if (logger && typeof (logger as any).close === 'function') {
    logger.info('Clean shutdown complete');
    (logger as any).close();
  }

  // 5. Now actually quit
  setTimeout(() => {
    isShuttingDown = false;
    app.quit();
  }, 100);
});

app.on('window-all-closed', () => {
  // Don't save here - already handled in before-quit
  
  // Log shutdown
  if (logger && !isShuttingDown) {
    logger.info('Window closed');
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
