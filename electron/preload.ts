import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings } from '../src/types/electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openPlaylist: () => ipcRenderer.invoke('dialog:openPlaylist'),
  loadPlaylistFromPath: (filePath: string) => ipcRenderer.invoke('playlist:loadFromPath', filePath),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  getSetting: (key: keyof AppSettings) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: keyof AppSettings, value: any) => ipcRenderer.invoke('settings:set', key, value),
  
  // Shell (for opening external links)
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },

  // Window controls (for TV mode)
  window: {
    toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
    setFullscreen: (fullscreen: boolean) => ipcRenderer.invoke('window:setFullscreen', fullscreen),
    isFullscreen: () => ipcRenderer.invoke('window:isFullscreen')
  },

  // IPC event listeners (for menu events)
  ipcRenderer: {
    on: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
    },
    removeListener: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, callback);
    }
  },
  
  // Player controls
  player: {
    play: (url: string) => ipcRenderer.invoke('player:play', url),
    stop: () => ipcRenderer.invoke('player:stop'),
    pause: () => ipcRenderer.invoke('player:pause'),
    resume: () => ipcRenderer.invoke('player:resume'),
    setVolume: (volume: number) => ipcRenderer.invoke('player:setVolume', volume),
    getVolume: () => ipcRenderer.invoke('player:getVolume'),
    getState: () => ipcRenderer.invoke('player:getState'),
    isPlaying: () => ipcRenderer.invoke('player:isPlaying'),
    playWithFallback: (channelId: string, urls: string[], lastSuccessfulUrl?: string) => 
      ipcRenderer.invoke('player:playWithFallback', channelId, urls, lastSuccessfulUrl),
    retryFallback: (channelId: string) => ipcRenderer.invoke('player:retryFallback', channelId),
    getLastSuccessfulUrl: (channelId: string) => ipcRenderer.invoke('player:getLastSuccessfulUrl', channelId),
    // Audio-only mode stubs (feature requires VLC SDK rebuild)
    setAudioOnly: (enabled: boolean) => Promise.resolve({ success: false, error: 'Audio-only mode not available' }),
    getAudioOnly: () => Promise.resolve(false)
  },
  
  // Stream health
  health: {
    getScore: (channelId: string) => ipcRenderer.invoke('health:getScore', channelId),
    getAllScores: () => ipcRenderer.invoke('health:getAllScores'),
    clear: (channelId?: string) => ipcRenderer.invoke('health:clear', channelId)
  },
  
  // Recording
  recording: {
    start: (channelId: string, channelName: string) => ipcRenderer.invoke('recording:start', channelId, channelName),
    stop: (channelId: string) => ipcRenderer.invoke('recording:stop', channelId),
    isRecording: (channelId?: string) => ipcRenderer.invoke('recording:isRecording', channelId),
    getInfo: (channelId: string) => ipcRenderer.invoke('recording:getInfo', channelId),
    getActive: () => ipcRenderer.invoke('recording:getActive'),
    getPath: () => ipcRenderer.invoke('recording:getPath')
  },

  // VLC audio controls
  vlc: {
    getAudioLevel: () => ipcRenderer.invoke('vlc:getAudioLevel'),
    setAudioGain: (gainDb: number) => ipcRenderer.invoke('vlc:setAudioGain', gainDb)
  },

  // EPG controls
  epg: {
    loadXmltv: (filePath: string) => ipcRenderer.invoke('epg:loadXmltv', filePath),
    openXmltvFile: () => ipcRenderer.invoke('epg:openXmltvFile'),
    getNowNext: (channelId: string) => ipcRenderer.invoke('epg:getNowNext', channelId),
    getGuideWindow: (channelIds: string[], startTime: number, endTime: number) => 
      ipcRenderer.invoke('epg:getGuideWindow', channelIds, startTime, endTime),
    getProgramsForDate: (channelId: string, dateStr: string) => 
      ipcRenderer.invoke('epg:getProgramsForDate', channelId, dateStr),
    getChannel: (channelId: string) => ipcRenderer.invoke('epg:getChannel', channelId),
    getAllChannels: () => ipcRenderer.invoke('epg:getAllChannels'),
    getStats: () => ipcRenderer.invoke('epg:getStats'),
    clear: () => ipcRenderer.invoke('epg:clear')
  },

  // Profile system
  profile: {
    list: () => ipcRenderer.invoke('profile:list'),
    create: (request: any) => ipcRenderer.invoke('profile:create', request),
    delete: (profileId: string) => ipcRenderer.invoke('profile:delete', profileId),
    login: (request: any) => ipcRenderer.invoke('profile:login', request),
    logout: () => ipcRenderer.invoke('profile:logout'),
    getActive: () => ipcRenderer.invoke('profile:getActive'),
    getLastActive: () => ipcRenderer.invoke('profile:getLastActive'),
    updateData: (data: any) => ipcRenderer.invoke('profile:updateData', data),
    save: () => ipcRenderer.invoke('profile:save'),
    verifyPin: (profileId: string, pin: string) => ipcRenderer.invoke('profile:verifyPin', profileId, pin)
  }
});

// Also expose as 'electron' for convenience
contextBridge.exposeInMainWorld('electron', {
  openPlaylist: () => ipcRenderer.invoke('dialog:openPlaylist'),
  loadPlaylistFromPath: (filePath: string) => ipcRenderer.invoke('playlist:loadFromPath', filePath),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  getSetting: (key: keyof AppSettings) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: keyof AppSettings, value: any) => ipcRenderer.invoke('settings:set', key, value),
  
  // Shell (for opening external links)
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },

  // Window controls (for TV mode)
  window: {
    toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
    setFullscreen: (fullscreen: boolean) => ipcRenderer.invoke('window:setFullscreen', fullscreen),
    isFullscreen: () => ipcRenderer.invoke('window:isFullscreen')
  },

  // IPC event listeners (for menu events)
  ipcRenderer: {
    on: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
    },
    removeListener: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, callback);
    }
  },
  
  // Player controls
  player: {
    play: (url: string) => ipcRenderer.invoke('player:play', url),
    stop: () => ipcRenderer.invoke('player:stop'),
    pause: () => ipcRenderer.invoke('player:pause'),
    resume: () => ipcRenderer.invoke('player:resume'),
    setVolume: (volume: number) => ipcRenderer.invoke('player:setVolume', volume),
    getVolume: () => ipcRenderer.invoke('player:getVolume'),
    getState: () => ipcRenderer.invoke('player:getState'),
    isPlaying: () => ipcRenderer.invoke('player:isPlaying'),
    playWithFallback: (channelId: string, urls: string[], lastSuccessfulUrl?: string) => 
      ipcRenderer.invoke('player:playWithFallback', channelId, urls, lastSuccessfulUrl),
    retryFallback: (channelId: string) => ipcRenderer.invoke('player:retryFallback', channelId),
    getLastSuccessfulUrl: (channelId: string) => ipcRenderer.invoke('player:getLastSuccessfulUrl', channelId),
    // Audio-only mode stubs (feature requires VLC SDK rebuild)
    setAudioOnly: (enabled: boolean) => Promise.resolve({ success: false, error: 'Audio-only mode not available' }),
    getAudioOnly: () => Promise.resolve(false)
  },
  
  // Stream health
  health: {
    getScore: (channelId: string) => ipcRenderer.invoke('health:getScore', channelId),
    getAllScores: () => ipcRenderer.invoke('health:getAllScores'),
    clear: (channelId?: string) => ipcRenderer.invoke('health:clear', channelId)
  },
  
  // Recording
  recording: {
    start: (channelId: string, channelName: string) => ipcRenderer.invoke('recording:start', channelId, channelName),
    stop: (channelId: string) => ipcRenderer.invoke('recording:stop', channelId),
    isRecording: (channelId?: string) => ipcRenderer.invoke('recording:isRecording', channelId),
    getInfo: (channelId: string) => ipcRenderer.invoke('recording:getInfo', channelId),
    getActive: () => ipcRenderer.invoke('recording:getActive'),
    getPath: () => ipcRenderer.invoke('recording:getPath')
  },

  // VLC audio controls
  vlc: {
    getAudioLevel: () => ipcRenderer.invoke('vlc:getAudioLevel'),
    setAudioGain: (gainDb: number) => ipcRenderer.invoke('vlc:setAudioGain', gainDb)
  },

  // EPG controls
  epg: {
    loadXmltv: (filePath: string) => ipcRenderer.invoke('epg:loadXmltv', filePath),
    openXmltvFile: () => ipcRenderer.invoke('epg:openXmltvFile'),
    getNowNext: (channelId: string) => ipcRenderer.invoke('epg:getNowNext', channelId),
    getGuideWindow: (channelIds: string[], startTime: number, endTime: number) => 
      ipcRenderer.invoke('epg:getGuideWindow', channelIds, startTime, endTime),
    getProgramsForDate: (channelId: string, dateStr: string) => 
      ipcRenderer.invoke('epg:getProgramsForDate', channelId, dateStr),
    getChannel: (channelId: string) => ipcRenderer.invoke('epg:getChannel', channelId),
    getAllChannels: () => ipcRenderer.invoke('epg:getAllChannels'),
    getStats: () => ipcRenderer.invoke('epg:getStats'),
    clear: () => ipcRenderer.invoke('epg:clear')
  },

  // Profile system
  profile: {
    list: () => ipcRenderer.invoke('profile:list'),
    create: (request: any) => ipcRenderer.invoke('profile:create', request),
    delete: (profileId: string) => ipcRenderer.invoke('profile:delete', profileId),
    login: (request: any) => ipcRenderer.invoke('profile:login', request),
    logout: () => ipcRenderer.invoke('profile:logout'),
    getActive: () => ipcRenderer.invoke('profile:getActive'),
    getLastActive: () => ipcRenderer.invoke('profile:getLastActive'),
    updateData: (data: any) => ipcRenderer.invoke('profile:updateData', data),
    save: () => ipcRenderer.invoke('profile:save'),
    verifyPin: (profileId: string, pin: string) => ipcRenderer.invoke('profile:verifyPin', profileId, pin)
  }
});
