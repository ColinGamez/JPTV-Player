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

/**
 * CRITICAL: Global error handlers for process-level failures
 * Prevents silent crashes and logs all unhandled errors
 */
process.on('uncaughtException', (error: Error) => {
  const errorMsg = `UNCAUGHT EXCEPTION: ${error.message}\nStack: ${error.stack}`;
  console.error('[FATAL]', errorMsg);
  logger?.error('Uncaught exception', { error: error.message, stack: error.stack });
  
  // Don't exit immediately - give time for logging
  setTimeout(() => {
    app.quit();
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const errorMsg = typeof reason === 'object' && reason !== null && 'message' in reason
    ? (reason as Error).message
    : String(reason);
  
  console.error('[FATAL] Unhandled Promise Rejection:', errorMsg);
  logger?.error('Unhandled promise rejection', { reason: errorMsg });
  
  // Don't crash on unhandled rejection, but log it prominently
});

// Forward renderer errors to main process log file
ipcMain.on('renderer:error', (_event, { error, componentStack }: { error: string; componentStack: string }) => {
  logger?.error('[Renderer Error]', { error, componentStack });
});

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
  favorites: string[];
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
    logger?.error('Failed to load settings', { error });
  }
  return defaultSettings;
}

function saveSettings(settings: AppSettings): void {
  try {
    // Atomic write: write to temp file then rename to prevent corruption on crash
    const tempPath = `${settingsPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2), 'utf-8');
    fs.renameSync(tempPath, settingsPath);
  } catch (error) {
    logger?.error('Failed to save settings', { error });
    // Clean up temp file if rename failed
    try {
      const tempPath = `${settingsPath}.tmp`;
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch { /* ignore cleanup errors */ }
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
      sandbox: true,
      webSecurity: true,
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
              detail: `Version: ${app.getVersion()}\nElectron IPTV Player with VLC backend`
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
    // In production, __dirname is resources/app.asar/dist/electron
    // We need to go up one level to find index.html at dist/index.html
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Show window once content is loaded (prevents flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // SECURITY: Prevent navigation away from the app (e.g., via malicious links)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // In dev, allow Vite HMR reloads
    if (isDev && url.startsWith('http://localhost:')) return;
    // In prod, allow loading the app's own file
    if (!isDev && url.startsWith('file://')) return;
    logger?.warn('Blocked navigation attempt', { url });
    event.preventDefault();
  });

  // SECURITY: Prevent new window creation (e.g., window.open)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    logger?.warn('Blocked new window attempt', { url });
    return { action: 'deny' };
  });

  // Initialize VLC player after window is ready
  mainWindow.webContents.once('did-finish-load', async () => {
    await initializeManagers();
    initializeVlcPlayer();
  });
}

/**
 * Initialize non-VLC managers (Profile, EPG, Recording)
 * Returns promise that resolves when critical managers are ready
 */
async function initializeManagers() {
  try {
    // Initialize logger
    logger = new RotatingLogger(logPath);
    logger.info('Initializing application managers');

    // Initialize managers that don't depend on VLC
    recordingManager = new RecordingManager(recordingsPath, logger);
    epgManager = new EpgManager(app.getPath('userData'), logger);
    profileManager = new ProfileManager(app.getPath('userData'), logger);
    
    // CRITICAL: Wait for profile manager initialization (creates directories)
    await profileManager.initialize();
    
    // Initialize EPG data (from cache if available) - non-blocking with timeout
    const EPG_INIT_TIMEOUT = 10000; // 10 seconds max for cache load
    Promise.race([
      epgManager.initialize(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('EPG initialization timeout')), EPG_INIT_TIMEOUT)
      )
    ]).catch(err => {
      logger?.error('EPG initialization failed or timed out', { error: err.message });
    });
    
    logger?.info('Managers initialized successfully');
  } catch (error) {
    logger?.error('Failed to initialize managers', { error });
    throw error; // Rethrow to prevent app from continuing with broken state
  }
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
    logger?.info('Initializing VLC player');

    // Set VLC plugin path for bundled runtime in production
    if (!isDev) {
      const vlcPath = path.join(process.resourcesPath, 'vlc');
      const pluginPath = path.join(vlcPath, 'plugins');
      
      if (fs.existsSync(vlcPath)) {
        process.env.VLC_PLUGIN_PATH = pluginPath;
        logger?.info('Using bundled VLC runtime', { vlcPath, pluginPath });
      } else {
        logger?.warn('Bundled VLC not found, falling back to system VLC', { vlcPath });
      }
    }

    // Load native VLC addon
    const addonPath = path.join(__dirname, '../build/Release/vlc_player.node');
    
    if (!fs.existsSync(addonPath)) {
      const error = 'Native addon not found';
      logger?.error(error, { path: addonPath, hint: 'Run npm run build:native' });
      return;
    }

    vlcPlayer = require(addonPath);

    // CRITICAL: Ensure mainWindow is ready before VLC initialization
    if (!mainWindow) {
      const error = 'Cannot initialize VLC: mainWindow not created yet';
      logger?.error(error);
      throw new Error(error); // Fail-fast: VLC requires window handle
    }

    // Get HWND from BrowserWindow
    const hwnd = mainWindow.getNativeWindowHandle();
    const hwndValue = hwnd.readBigInt64LE(0);
    
    const success = vlcPlayer.initialize(hwndValue);
    if (success) {
      logger?.info('VLC player initialized successfully');
      
      // Initialize VLC-dependent managers
      healthScorer = new StreamHealthScorer();
      fallbackManager = new StreamFallbackManager(logger!);
      
      startFreezeDetection();
      startHealthMonitoring();
    } else {
      const error = 'VLC initialization returned false';
      logger?.error(error);
      throw new Error(error); // Fail-fast: VLC must initialize
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger?.error('Failed to load VLC native addon', { error: errorMsg, hint: 'Ensure VLC is installed and addon is compiled' });
    throw error; // Fail-fast: VLC is critical for app functionality
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

// Helper function to parse playlist from file path
function parsePlaylistFromPath(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parseResult: ParserResult = parseM3U(content);
    
    if (!parseResult.success) {
      logger?.error('Failed to parse playlist', { path: filePath, error: parseResult.error });
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger?.error('Failed to read playlist file', { path: filePath, error: errorMessage });
    return {
      path: filePath,
      content: '',
      parseResult: {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file'
      }
    };
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
  return parsePlaylistFromPath(filePath);
});

// Load playlist from saved path (for profile restoration)
ipcMain.handle('playlist:loadFromPath', async (_event, filePath: string) => {
  // Input validation
  if (!filePath || typeof filePath !== 'string') {
    logger?.warn('Invalid playlist path', { path: filePath });
    return {
      path: '',
      content: '',
      parseResult: { success: false, error: 'Invalid file path' }
    };
  }

  // Sanitize path to prevent directory traversal
  const normalizedPath = path.resolve(filePath);
  
  // Block paths that still contain traversal sequences after resolution
  if (normalizedPath.includes('..')) {
    logger?.warn('Blocked path traversal attempt', { original: filePath, resolved: normalizedPath });
    return {
      path: '',
      content: '',
      parseResult: { success: false, error: 'Invalid file path' }
    };
  }
  
  // Validate file exists
  if (!fs.existsSync(normalizedPath)) {
    logger?.warn('Playlist file not found', { path: normalizedPath });
    return {
      path: normalizedPath,
      content: '',
      parseResult: { success: false, error: 'File not found' }
    };
  }

  // Validate file extension
  const ext = path.extname(normalizedPath).toLowerCase();
  if (ext !== '.m3u' && ext !== '.m3u8') {
    logger?.warn('Invalid playlist file extension', { path: normalizedPath, ext });
    return {
      path: normalizedPath,
      content: '',
      parseResult: { success: false, error: 'Invalid file type (must be .m3u or .m3u8)' }
    };
  }

  logger?.info('Loading playlist from saved path', { path: normalizedPath });
  return parsePlaylistFromPath(normalizedPath);
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

const VALID_SETTINGS_KEYS: ReadonlySet<keyof AppSettings> = new Set([
  'lastPlaylist', 'lastChannelId', 'lastChannelIndex',
  'channelHistory', 'favorites', 'volume'
]);

ipcMain.handle('settings:set', (_event, key: keyof AppSettings, value: any) => {
  if (!VALID_SETTINGS_KEYS.has(key)) {
    logger?.warn('Rejected invalid settings key', { key });
    return false;
  }
  const settings = loadSettings();
  (settings as any)[key] = value;
  saveSettings(settings);
  return true;
});

// File reading handler for EPG/XMLTV files
// SECURITY: Restricted to safe file extensions to prevent arbitrary filesystem reads
ipcMain.handle('file:read', async (_event, filePath: string) => {
  try {
    // Validate file path
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path');
    }

    // Normalize and resolve the path to prevent path traversal
    const resolvedPath = path.resolve(filePath);

    // Restrict to safe file extensions
    const allowedExtensions = ['.xml', '.xmltv', '.m3u', '.m3u8', '.txt', '.json'];
    const ext = path.extname(resolvedPath).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      logger?.warn('Blocked file read: disallowed extension', { filePath, ext });
      throw new Error(`File type not allowed: ${ext}`);
    }

    logger?.debug('Reading file', { filePath: resolvedPath });
    const content = fs.readFileSync(resolvedPath, 'utf-8');
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
    return { success: false };
  }
});

ipcMain.handle('player:setVolume', async (_event, volume: number) => {
  if (!vlcPlayer) {
    return { success: false };
  }

  // Validate volume: must be a finite number in range [0, 200]
  if (typeof volume !== 'number' || !isFinite(volume)) {
    logger?.warn('setVolume rejected invalid value', { volume });
    return { success: false };
  }
  const clamped = Math.max(0, Math.min(200, Math.round(volume)));

  try {
    // Update base volume for audio normalization tracking
    audioBaseVolume = clamped;
    audioAppliedGainDb = 0; // Reset gain when user manually sets volume
    const success = vlcPlayer.setVolume(clamped);
    return { success };
  } catch (error) {
    logger?.error('SetVolume error', { volume: clamped, error });
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
 * @param depth - recursion guard to prevent stack overflow
 */
const MAX_FALLBACK_DEPTH = 20;

async function tryNextFallbackUrl(channelId: string, depth = 0): Promise<{ success: boolean; error?: string; url?: string }> {
  if (!vlcPlayer || !fallbackManager) {
    return { success: false, error: 'Player or fallback manager not available' };
  }

  if (depth >= MAX_FALLBACK_DEPTH) {
    logger?.error('Fallback depth limit reached', { channelId, depth });
    return { success: false, error: 'Too many fallback attempts' };
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
      return await tryNextFallbackUrl(channelId, depth + 1);
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
// Track the base volume (before gain) and applied gain to prevent feedback loop
let audioBaseVolume: number = 50; // The user-set volume before normalization gain
let audioAppliedGainDb: number = 0; // Currently applied gain in dB

ipcMain.handle('vlc:getAudioLevel', async () => {
  if (!vlcPlayer) {
    logger?.warn('VLC player not initialized for getAudioLevel');
    return -96; // Return very low level if player not available
  }

  try {
    // Get current audio volume as a proxy for level
    // Use base volume (pre-gain) to prevent feedback loop where
    // applied gain shifts the reading, causing another gain adjustment
    const volume = audioBaseVolume;
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
    // Apply gain relative to the base volume (not the current adjusted volume)
    // This prevents the feedback loop where applied gain shifts the next reading
    audioAppliedGainDb = gainDb;
    
    // Convert gain (dB) to linear scale factor
    // 6 dB = 2x, -6 dB = 0.5x
    const linearGain = Math.pow(10, gainDb / 20);
    
    // Apply gain to base volume, clamping to valid range
    const newVolume = Math.max(0, Math.min(100, audioBaseVolume * linearGain));
    
    vlcPlayer.setVolume(newVolume);
    logger?.info('Applied audio gain', { gainDb, baseVolume: audioBaseVolume, newVolume });
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

  // Validate and sanitize path
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: 'Invalid file path' };
  }
  const resolvedEpgPath = path.resolve(filePath);

  // Validate file extension
  const ext = path.extname(resolvedEpgPath).toLowerCase();
  if (!['.xml', '.xmltv'].includes(ext)) {
    logger?.warn('Invalid EPG file extension', { filePath: resolvedEpgPath, ext });
    return { success: false, error: `Invalid file type: ${ext}. Expected .xml or .xmltv` };
  }

  try {
    logger?.info('Loading XMLTV file', { filePath: resolvedEpgPath });
    const result = await epgManager.loadFromXmltv(resolvedEpgPath);
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
    if (isNaN(date.getTime())) {
      logger?.warn('epg:getProgramsForDate invalid date string', { dateStr });
      return [];
    }
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
/**
 * Cleanup orphaned VLC processes from previous app crashes
 * CRITICAL: Kills vlc.exe processes to prevent resource locks and playback failures
 */
function cleanupOrphanedVlcProcesses(): void {
  if (process.platform !== 'win32') return;

  try {
    const { execSync } = require('child_process');
    
    // Find VLC processes
    const result = execSync('tasklist /FI "IMAGENAME eq vlc.exe" /FO CSV /NH', { encoding: 'utf8' });
    
    if (result.includes('vlc.exe')) {
      logger?.warn('Found orphaned VLC processes, attempting cleanup', { processes: result.trim() });
      
      try {
        // Force kill ALL vlc.exe processes
        // /F = force terminate, /IM = image name
        execSync('taskkill /F /IM vlc.exe', { encoding: 'utf8', timeout: 5000 });
        logger?.info('Successfully cleaned up orphaned VLC processes');
      } catch (killError) {
        // Some VLC processes may have already exited or are protected
        logger?.warn('Failed to kill some VLC processes', { error: killError });
      }
    } else {
      logger?.debug('No orphaned VLC processes found');
    }
  } catch (error) {
    // tasklist command failed - log but don't crash
    logger?.error('Failed to check for orphaned VLC processes', { error });
  }
}

ipcMain.handle('shell:openExternal', async (_, url: string) => {
  try {
    // Security: Only allow http(s) URLs
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      throw new Error(`Blocked opening non-HTTP URL: ${url}`);
    }
    logger?.info('Opening external URL', { url });
    await shell.openExternal(url);
  } catch (error) {
    logger?.error('Failed to open external URL', { error, url });
    throw error;
  }
});

app.whenReady().then(() => {
  // IPC handlers are registered at module level (top-level ipcMain.handle calls)
  // No additional registration needed here
  
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

  // 4. Flush logger
  if (logger) {
    logger.info('Clean shutdown complete');
    logger.close();
  }

  // 5. Now actually quit
  // NOTE: Do NOT reset isShuttingDown — app.quit() re-emits before-quit,
  // and the guard at the top must return immediately to let the quit proceed.
  setTimeout(() => {
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
