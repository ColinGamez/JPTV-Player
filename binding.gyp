{
  "targets": [
    {
      "target_name": "vlc_player",
      "sources": [
        "native/vlc_player.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!(echo %VLC_INCLUDE%)",
        "C:/Program Files/VideoLAN/VLC/sdk/include"
      ],
      "libraries": [
        "<!(echo %VLC_LIB%)/libvlc.lib",
        "<!(echo %VLC_LIB%)/libvlccore.lib",
        "-lC:/Program Files/VideoLAN/VLC/sdk/lib/libvlc.lib",
        "-lC:/Program Files/VideoLAN/VLC/sdk/lib/libvlccore.lib"
      ],
      "defines": [
        "NAPI_VERSION=8",
        "NAPI_CPP_EXCEPTIONS"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [
            "/EHsc"
          ]
        }
      },
      "conditions": [
        [
          "OS==\"win\"",
          {
            "defines": [
              "WIN32"
            ]
          }
        ]
      ]
    }
  ]
}
