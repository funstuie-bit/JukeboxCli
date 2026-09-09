class Jukeboxcli < Formula
  desc "Mac-first terminal music player with local and online queues"
  homepage "https://github.com/funstuie-bit/JukeboxCli"
  # Private repository: Git uses the user's credential helper, never an embedded token.
  url "https://github.com/funstuie-bit/JukeboxCli.git",
      revision: "c44146b0f4bf2b3017e8bbe8e06c7b1ee78eb022"
  version "0.1.0-dev.13"
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
      Private development formula: GitHub access is required to install/update.
      Run jukeboxcli --doctor to check dependencies. Homebrew manages tool updates.
      Existing soundcli music, cookies and profile paths are retained.
      No soundcli alias is linked, so an older soundcli command can coexist.
      Physical media-key/Control Centre acceptance remains a separate check.
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
