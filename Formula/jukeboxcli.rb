class Jukeboxcli < Formula
  desc "Mac-first terminal music player with local and online queues"
  homepage "https://github.com/funstuie-bit/JukeboxCli"
  url "https://github.com/funstuie-bit/JukeboxCli.git",
      tag: "v0.1.1-beta.2",
      revision: "c69852ce0a3134269e72aa6e95cbc6a50ea64342"
  version "0.1.1-beta.2"
  license "MIT"

  depends_on :macos
  depends_on "node"
  depends_on "mpv"
  depends_on "ffmpeg"
  depends_on "yt-dlp"

  def install
    # Build from package-lock.json, then keep only the locked runtime dependencies.
    system "npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"
    system "npm", "run", "build"
    system "node", "dist/index.js", "--version"
    libexec.install "dist", "package.json", "package-lock.json"
    cd libexec do
      system "npm", "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"
    end
    (bin/"jukeboxcli").write <<~SH
      #!/bin/sh
      export PATH="#{Formula["node"].opt_bin}:#{Formula["mpv"].opt_bin}:#{Formula["ffmpeg"].opt_bin}:#{Formula["yt-dlp"].opt_bin}:$PATH"
      export JUKEBOXCLI_SYSTEM_TOOLS=1
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/dist/index.js" "$@"
    SH
  end

  def caveats
    <<~EOS
      Run jukeboxcli --doctor to check dependencies. Homebrew manages tool updates.
      macOS media controls use mpv; system player identity may appear as mpv.
    EOS
  end

  test do
    ENV["JUKEBOXCLI_HOME"] = (testpath/"profile").to_s
    assert_equal version.to_s, shell_output("#{bin}/jukeboxcli --version").strip
    assert_match "--doctor", shell_output("#{bin}/jukeboxcli --help")
    report = JSON.parse(shell_output("#{bin}/jukeboxcli --doctor"))
    assert report.fetch("ok")
    refute_path_exists testpath/"profile"
  end
end
