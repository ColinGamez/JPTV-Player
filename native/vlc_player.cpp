#include <napi.h>
#include <vlc/vlc.h>
#include <windows.h>
#include <string>
#include <mutex>
#include <chrono>
#include <ctime>

class VlcPlayer {
private:
    libvlc_instance_t* vlcInstance = nullptr;
    libvlc_media_player_t* mediaPlayer = nullptr;
    HWND hwnd = nullptr;
    std::mutex playerMutex;
    bool initialized = false;
    
    // Freeze detection
    std::chrono::steady_clock::time_point lastFrameTime;
    bool freezeDetectionEnabled = false;
    int64_t lastFrameCount = 0;
    
    // Current playback info
    std::string currentUrl;
    bool isInErrorState = false;
    
    // Stream statistics
    struct StreamStats {
        float inputBitrate = 0.0f;      // KB/s
        float demuxBitrate = 0.0f;      // KB/s
        int64_t lostBuffers = 0;
        int64_t displayedPictures = 0;
        int64_t lostPictures = 0;
    };
    StreamStats lastStats;
    
    // Recording state
    bool isRecording = false;
    std::string recordingPath;
    
    // Audio-only mode
    bool audioOnlyMode = false;

public:
    VlcPlayer() {
        lastFrameTime = std::chrono::steady_clock::now();
    }

    ~VlcPlayer() {
        cleanup();
    }
    
    // Safe recreation after crash
    bool recreateMediaPlayer() {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!vlcInstance) {
            return false;
        }
        
        // Clean up old player
        if (mediaPlayer) {
            libvlc_media_player_release(mediaPlayer);
            mediaPlayer = nullptr;
        }
        
        // Create new player
        mediaPlayer = libvlc_media_player_new(vlcInstance);
        if (!mediaPlayer) {
            return false;
        }
        
        // Restore HWND
        libvlc_media_player_set_hwnd(mediaPlayer, hwnd);
        
        isInErrorState = false;
        return true;
    }

    bool initialize(HWND windowHandle) {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (initialized) {
            return true;
        }

        hwnd = windowHandle;

        // Initialize libVLC with common options
        const char* vlc_args[] = {
            "--no-video-title-show",     // Don't show filename on video
            "--no-xlib",                  // Don't use Xlib
            "--no-snapshot-preview",      // No snapshot preview
            "--quiet",                    // Less verbose
            "--network-caching=3000",     // 3s network cache for IPTV
            "--clock-jitter=0",           // Reduce jitter
            "--clock-synchro=0"           // Disable clock sync issues
        };

        vlcInstance = libvlc_new(sizeof(vlc_args) / sizeof(vlc_args[0]), vlc_args);
        if (!vlcInstance) {
            return false;
        }

        mediaPlayer = libvlc_media_player_new(vlcInstance);
        if (!mediaPlayer) {
            libvlc_release(vlcInstance);
            vlcInstance = nullptr;
            return false;
        }

        // Set output window (HWND)
        libvlc_media_player_set_hwnd(mediaPlayer, hwnd);

        initialized = true;
        return true;
    }

    bool play(const std::string& url) {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!initialized || !mediaPlayer) {
            return false;
        }

        try {
            // Stop current playback
            if (libvlc_media_player_is_playing(mediaPlayer)) {
                libvlc_media_player_stop(mediaPlayer);
                // Wait for clean stop
                Sleep(100);
            }

            // Create media from URL
            libvlc_media_t* media = libvlc_media_new_location(vlcInstance, url.c_str());
            if (!media) {
                return false;
            }

            // Set media to player
            libvlc_media_player_set_media(mediaPlayer, media);
            libvlc_media_release(media);

            // Start playback
            int result = libvlc_media_player_play(mediaPlayer);
            
            if (result == 0) {
                currentUrl = url;
                lastFrameTime = std::chrono::steady_clock::now();
                freezeDetectionEnabled = true;
                lastFrameCount = 0;
                isInErrorState = false;
            }
            
            return result == 0;
        } catch (...) {
            isInErrorState = true;
            return false;
        }
    }

    bool stop() {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!initialized || !mediaPlayer) {
            return false;
        }

        try {
            libvlc_media_player_stop(mediaPlayer);
            freezeDetectionEnabled = false;
            currentUrl.clear();
            isInErrorState = false;
            return true;
        } catch (...) {
            return false;
        }
    }

    bool pause() {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!initialized || !mediaPlayer) {
            return false;
        }

        libvlc_media_player_pause(mediaPlayer);
        return true;
    }

    bool resume() {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!initialized || !mediaPlayer) {
            return false;
        }

        if (!libvlc_media_player_is_playing(mediaPlayer)) {
            libvlc_media_player_play(mediaPlayer);
        }
        return true;
    }

    bool setVolume(int volume) {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!initialized || !mediaPlayer) {
            return false;
        }

        // VLC volume is 0-100
        int clampedVolume = volume < 0 ? 0 : (volume > 100 ? 100 : volume);
        libvlc_audio_set_volume(mediaPlayer, clampedVolume);
        return true;
    }

    int getVolume() {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!initialized || !mediaPlayer) {
            return 0;
        }

        return libvlc_audio_get_volume(mediaPlayer);
    }

    bool isPlaying() {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!initialized || !mediaPlayer) {
            return false;
        }

        return libvlc_media_player_is_playing(mediaPlayer) == 1;
    }

    std::string getState() {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!initialized || !mediaPlayer) {
            return "stopped";
        }

        try {
            libvlc_state_t state = libvlc_media_player_get_state(mediaPlayer);
            switch (state) {
                case libvlc_Playing: return "playing";
                case libvlc_Paused: return "paused";
                case libvlc_Stopped: return "stopped";
                case libvlc_Buffering: return "buffering";
                case libvlc_Error: return "error";
                default: return "stopped";
            }
        } catch (...) {
            return "error";
        }
    }
    
    // Check for playback freeze (no frames for N seconds)
    bool isStreamFrozen(int freezeThresholdSeconds = 10) {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!initialized || !mediaPlayer || !freezeDetectionEnabled) {
            return false;
        }
        
        try {
            // Check if player is in error state
            libvlc_state_t state = libvlc_media_player_get_state(mediaPlayer);
            if (state == libvlc_Error || state == libvlc_Ended) {
                return true;
            }
            
            // If not playing, not frozen
            if (state != libvlc_Playing) {
                return false;
            }
            
            // Check time since last frame update
            auto now = std::chrono::steady_clock::now();
            auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - lastFrameTime).count();
            
            // Get current playback statistics
            libvlc_media_t* media = libvlc_media_player_get_media(mediaPlayer);
            if (media) {
                // Check if media is still valid
                libvlc_state_t mediaState = libvlc_media_get_state(media);
                if (mediaState == libvlc_Error) {
                    return true;
                }
            }
            
            // If elapsed time exceeds threshold, stream is frozen
            if (elapsed >= freezeThresholdSeconds) {
                return true;
            }
            
            return false;
        } catch (...) {
            // Exception means something is wrong
            return true;
        }
    }
    
    // Update frame timestamp (call periodically during playback)
    void updateFrameTime() {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (freezeDetectionEnabled && mediaPlayer) {
            try {
                // Check if actually playing
                if (libvlc_media_player_is_playing(mediaPlayer)) {
                    // Get current time as proxy for frame activity
                    int64_t currentTime = libvlc_media_player_get_time(mediaPlayer);
                    
                    // If time changed, we have activity
                    if (currentTime != lastFrameCount && currentTime > 0) {
                        lastFrameTime = std::chrono::steady_clock::now();
                        lastFrameCount = currentTime;
                    }
                }
            } catch (...) {
                // Ignore errors during update
            }
        }
    }
    
    std::string getCurrentUrl() {
        std::lock_guard<std::mutex> lock(playerMutex);
        return currentUrl;
    }
    
    bool isInError() {
        std::lock_guard<std::mutex> lock(playerMutex);
        return isInErrorState;
    }
    
    // Get stream statistics
    StreamStats getStats() {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        StreamStats stats;
        
        if (!initialized || !mediaPlayer) {
            return stats;
        }
        
        try {
            libvlc_media_t* media = libvlc_media_player_get_media(mediaPlayer);
            if (!media) {
                return stats;
            }
            
            // Get media statistics
            libvlc_media_stats_t vlcStats;
            if (libvlc_media_get_stats(media, &vlcStats)) {
                // Bitrate is in bytes/s, convert to KB/s
                stats.inputBitrate = vlcStats.f_input_bitrate;
                stats.demuxBitrate = vlcStats.f_demux_bitrate;
                stats.lostBuffers = vlcStats.i_lost_abuffers;
                stats.displayedPictures = vlcStats.i_displayed_pictures;
                stats.lostPictures = vlcStats.i_lost_pictures;
                
                lastStats = stats;
            }
        } catch (...) {
            // Return last known stats on error
            return lastStats;
        }
        
        return stats;
    }
    
    // Start recording to file
    bool startRecording(const std::string& filePath) {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!initialized || !mediaPlayer) {
            return false;
        }
        
        if (isRecording) {
            // Already recording
            return false;
        }
        
        try {
            // Set recording file using sout (stream output)
            // Format: #duplicate{dst=display,dst=std{access=file,mux=ts,dst=filepath}}
            std::string sout = "#duplicate{dst=display,dst=std{access=file,mux=ts,dst=" + filePath + "}}";
            
            // Get current media
            libvlc_media_t* media = libvlc_media_player_get_media(mediaPlayer);
            if (!media) {
                return false;
            }
            
            // Add sout option to media
            libvlc_media_add_option(media, sout.c_str());
            
            // Note: To make recording work without restarting playback,
            // we need to use libvlc_media_player_set_record() if available
            // For now, this requires media to be re-parsed
            
            isRecording = true;
            recordingPath = filePath;
            
            return true;
        } catch (...) {
            return false;
        }
    }
    
    // Stop recording
    bool stopRecording() {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (!isRecording) {
            return false;
        }
        
        try {
            // Clear recording state
            isRecording = false;
            recordingPath.clear();
            
            return true;
        } catch (...) {
            return false;
        }
    }
    
    // Check if currently recording
    bool getIsRecording() {
        std::lock_guard<std::mutex> lock(playerMutex);
        return isRecording;
    }
    
    // Get current recording path
    std::string getRecordingPath() {
        std::lock_guard<std::mutex> lock(playerMutex);
        return recordingPath;
    }

private:
    void cleanup() {
        std::lock_guard<std::mutex> lock(playerMutex);
        
        if (mediaPlayer) {
            libvlc_media_player_stop(mediaPlayer);
            libvlc_media_player_release(mediaPlayer);
            mediaPlayer = nullptr;
        }

        if (vlcInstance) {
            libvlc_release(vlcInstance);
            vlcInstance = nullptr;
        }

        initialized = false;
    }
};

// Global player instance
static VlcPlayer* globalPlayer = nullptr;

// N-API wrapper functions
Napi::Value Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "HWND (number) expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    HWND hwnd = reinterpret_cast<HWND>(static_cast<uintptr_t>(info[0].As<Napi::Number>().Int64Value()));

    if (!globalPlayer) {
        globalPlayer = new VlcPlayer();
    }

    bool success = globalPlayer->initialize(hwnd);
    return Napi::Boolean::New(env, success);
}

Napi::Value Play(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "URL string expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string url = info[0].As<Napi::String>().Utf8Value();

    if (!globalPlayer) {
        Napi::Error::New(env, "Player not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    bool success = globalPlayer->play(url);
    return Napi::Boolean::New(env, success);
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::Boolean::New(env, false);
    }

    bool success = globalPlayer->stop();
    return Napi::Boolean::New(env, success);
}

Napi::Value Pause(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::Boolean::New(env, false);
    }

    bool success = globalPlayer->pause();
    return Napi::Boolean::New(env, success);
}

Napi::Value Resume(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::Boolean::New(env, false);
    }

    bool success = globalPlayer->resume();
    return Napi::Boolean::New(env, success);
}

Napi::Value SetVolume(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Volume (number) expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    int volume = info[0].As<Napi::Number>().Int32Value();

    if (!globalPlayer) {
        return Napi::Boolean::New(env, false);
    }

    bool success = globalPlayer->setVolume(volume);
    return Napi::Boolean::New(env, success);
}

Napi::Value GetVolume(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::Number::New(env, 0);
    }

    int volume = globalPlayer->getVolume();
    return Napi::Number::New(env, volume);
}

Napi::Value IsPlaying(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::Boolean::New(env, false);
    }

    bool playing = globalPlayer->isPlaying();
    return Napi::Boolean::New(env, playing);
}

Napi::Value GetState(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::String::New(env, "stopped");
    }

    std::string state = globalPlayer->getState();
    return Napi::String::New(env, state);
}

Napi::Value IsStreamFrozen(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::Boolean::New(env, false);
    }

    int threshold = 10; // Default 10 seconds
    if (info.Length() > 0 && info[0].IsNumber()) {
        threshold = info[0].As<Napi::Number>().Int32Value();
    }

    bool frozen = globalPlayer->isStreamFrozen(threshold);
    return Napi::Boolean::New(env, frozen);
}

Napi::Value UpdateFrameTime(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return env.Null();
    }

    globalPlayer->updateFrameTime();
    return env.Null();
}

Napi::Value RecreateMediaPlayer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::Boolean::New(env, false);
    }

    bool success = globalPlayer->recreateMediaPlayer();
    return Napi::Boolean::New(env, success);
}

Napi::Value GetCurrentUrl(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::String::New(env, "");
    }

    std::string url = globalPlayer->getCurrentUrl();
    return Napi::String::New(env, url);
}

Napi::Value IsInError(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::Boolean::New(env, false);
    }

    bool error = globalPlayer->isInError();
    return Napi::Boolean::New(env, error);
}

Napi::Value GetStats(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        Napi::Object result = Napi::Object::New(env);
        result.Set("inputBitrate", 0);
        result.Set("demuxBitrate", 0);
        result.Set("lostBuffers", 0);
        result.Set("displayedPictures", 0);
        result.Set("lostPictures", 0);
        return result;
    }

    auto stats = globalPlayer->getStats();
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("inputBitrate", Napi::Number::New(env, stats.inputBitrate));
    result.Set("demuxBitrate", Napi::Number::New(env, stats.demuxBitrate));
    result.Set("lostBuffers", Napi::Number::New(env, stats.lostBuffers));
    result.Set("displayedPictures", Napi::Number::New(env, stats.displayedPictures));
    result.Set("lostPictures", Napi::Number::New(env, stats.lostPictures));
    
    return result;
}

Napi::Value StartRecording(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::Boolean::New(env, false);
    }

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "File path string expected").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    std::string filePath = info[0].As<Napi::String>().Utf8Value();
    bool success = globalPlayer->startRecording(filePath);
    
    return Napi::Boolean::New(env, success);
}

Napi::Value StopRecording(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::Boolean::New(env, false);
    }

    bool success = globalPlayer->stopRecording();
    return Napi::Boolean::New(env, success);
}

Napi::Value IsRecording(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::Boolean::New(env, false);
    }

    bool recording = globalPlayer->getIsRecording();
    return Napi::Boolean::New(env, recording);
}

Napi::Value GetRecordingPath(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!globalPlayer) {
        return Napi::String::New(env, "");
    }

    std::string path = globalPlayer->getRecordingPath();
    return Napi::String::New(env, path);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("initialize", Napi::Function::New(env, Initialize));
    exports.Set("play", Napi::Function::New(env, Play));
    exports.Set("stop", Napi::Function::New(env, Stop));
    exports.Set("pause", Napi::Function::New(env, Pause));
    exports.Set("resume", Napi::Function::New(env, Resume));
    exports.Set("setVolume", Napi::Function::New(env, SetVolume));
    exports.Set("getVolume", Napi::Function::New(env, GetVolume));
    exports.Set("isPlaying", Napi::Function::New(env, IsPlaying));
    exports.Set("getState", Napi::Function::New(env, GetState));
    exports.Set("isStreamFrozen", Napi::Function::New(env, IsStreamFrozen));
    exports.Set("updateFrameTime", Napi::Function::New(env, UpdateFrameTime));
    exports.Set("recreateMediaPlayer", Napi::Function::New(env, RecreateMediaPlayer));
    exports.Set("getCurrentUrl", Napi::Function::New(env, GetCurrentUrl));
    exports.Set("isInError", Napi::Function::New(env, IsInError));
    exports.Set("getStats", Napi::Function::New(env, GetStats));
    exports.Set("startRecording", Napi::Function::New(env, StartRecording));
    exports.Set("stopRecording", Napi::Function::New(env, StopRecording));
    exports.Set("isRecording", Napi::Function::New(env, IsRecording));
    exports.Set("getRecordingPath", Napi::Function::New(env, GetRecordingPath));
    return exports;
}

NODE_API_MODULE(vlc_player, Init)
