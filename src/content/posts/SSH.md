---
title: SSH 配置分享
published: 2025-10-30
# lang: ''
description: 之前一直在用 Termius 管理好多服务器，和其他诸如 Xshell 和 FinalShell 的商业软件相比，主要是看中了它的多设备 SSH 信息同步，也是突发奇想，看看能不能摆脱对这种软件的限制，同时体验不输 Termius。

---

> 阅读本文可能需要一定基础，不适合小白跟着做

之前一直在用 Termius 管理好多服务器，和其他诸如 Xshell 和 FinalShell 的商业软件相比，主要是看中了它的多设备 SSH 信息同步，也是突发奇想，看看能不能摆脱对这种软件的限制，同时体验不输 Termius。

总结之后，我对新方案的要求有：
- 必须支持多设备 SSH 信息同步
- 必须支持 SSH 密钥（密码太不安全了）
- 必须支持自定义配置文件（方便管理不同服务器）
- 必须支持跨平台（如 Windows、macOS、Linux 等）
- 必须支持多种网络协议（如 SSH、SFTP、FTP 等）

那么，我们自然得出需要在系统自带的 OpenSSH 上入手。

## SSH 信息与别名

### 配置管理

首先，OpenSSH 本身就支持 SSH 自定义配置文件，我们可以利用这些特性来满足我们的需求。之前 Termius 可以添加 Host，我们原版 OpenSSH 当然也是支持的。

```
Host *
    KexAlgorithms mlkem768x25519-sha256,sntrup761x25519-sha512@openssh.com,curve25519-sha256,curve25519-sha256@libssh.org
    HostKeyAlgorithms ssh-ed25519,rsa-sha2-512,rsa-sha2-256
    Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
    MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
    ServerAliveInterval 60

Host us
    Hostname us.example.tld
    User root
    Port 22
```

如上面示例，我们首先配置了一些较新的后量子密钥交换算法，配置了保活包的发送间隔。之后，我们可以参考`us`这个 Host 来定义一个新的主机。之后，我们可以较为方便地直接连接这个主机：

```shell
ssh us
```

配置了别名后，上面这行指令其实是等价于：

```shell
ssh -p 22 root@us.example.tld
```

可以看到，省了很多事情。

除此之外，配置文件支持`Include`指令，可以将多个配置文件拆分成多个部分，方便管理。例如，我们可以将不同环境的配置放在不同的文件中，然后在主配置文件中通过`Include`指令引入它们：

```
Include ~/.ssh/config.d/personal/*.conf
Include ~/.ssh/config.d/work/*.conf

# ... your existing conf here
```

这样的话，配置文件就变得更加模块化，便于管理和维护。且连接的时候也颇为方便，可以直接使用别名进行连接，类似于 Termius 的连接体验。

### 配置同步

为了满足我们将 SSH 配置同步到各个机器上的需求，我们采用 yadm + Github 的形式。

yadm 是管理 dotfiles 的一个工具，刚好符合我们的使用场景。我们在 Github 上创建一个仓库，名字为`dotfiles`。

随后我们需要设置一下 yadm，让他 untrack 某些文件（比如私钥）：

```
vim ~/.local/share/yadm/repo.git/info/exclude
```
示例如下：
```
# git ls-files --others --exclude-from=.git/info/exclude
# Lines that start with '#' are comments.
# For a project mostly in C, the following would be a good set of
# exclude patterns (uncomment them if you want to use them):
# *.[oa]
# *~
.ssh/id_*
.ssh/*.pem
!.ssh/id_*.pub
.ssh/known_hosts
.ssh/known_hosts.old
.ssh/authorized_keys
.ssh/sockets/
.ssh/sealos/
!.ssh/config
!.ssh/config.d
```

这里加`!`的行恰好是`exclude`的反义`include`。

随后，我们可以执行以下命令：

```
yadm init

yadm remote add origin https://github.com/{username}/dotfiles.git

yadm add ~/.ssh

yadm commit -m "Initial commit"

yadm push -u origin main
```

在另一台电脑上，我们安装好 yadm 后，只需`yadm clone https://github.com/{username}/dotfiles.git`克隆 dotfiles 仓库即可，如果做出更改，那么就重新执行`yadm add ~/.ssh && yadm commit && yadm push`，然后在其他设备上`yadm pull`，即可做到配置同步。

## SSH 密钥

密码还是太不方便且太不安全了，这是不可接受的。所以我的所有服务器都使用 SSH 密钥进行身份验证。

——那么，SSH 密钥该如何管理呢？

### SSH 公钥分发

一开始考虑了很多方案，比如 Ansible 分发等，总感觉不太优雅。于是决定使用 Github 的密钥管理，让每个服务器自动从 Github 上拉取公钥。

格式为：
```
https://github.com/{username}.keys
```

Ubuntu 发行版自带`ssh-import-id`，可以使用`ssh-import-id gh:{username}`来导入公钥。

如果你的发行版没有且你也不想安装，可以执行以下指令，其会自动将你 Github 账号的公钥加入到机器信任的公钥中来：

```
curl https://github.com/{username}.keys >> ~/.ssh/authorized_keys
```

如果你有需求，可以设置一个 crontab 计划任务，不过可能要注意旧公钥的清理。

### SSH 私钥安全

最安全的实践当然是一机一钥或者使用 SSH 证书，这样的话如果产生泄漏事件可以第一时间做紧急措施。但是考虑到我貌似并没有如此高的安全需求，毕竟属于个人爱好者，就选择了单密钥的策略。

如何保证单密钥的安全呢？我选择了 Bitwarden。

我们肯定不能把 SSH 私钥随时放在本地——尤其是公司的工作电脑上。所以我决定使用 Vaultwarden 私有化部署，并使用 Bitwarden 的 SSH Agent 功能，在 SSH 连接远程主机时，SSH Agent 会自动读取 Bitwarden 密码库中的私钥，并在解锁后提供给 SSH 客户端，锁定后即自动禁止私钥的读取。

至于私有化部署的安全性嘛，自己的数据自己负责，我是用 Docker 跑的 Vaultwarden 服务端，然后定时任务把 Docker Volume 加密后上传到阿里云的 OSS 和 Cloudflare R2 存储中，保证不会丢失，毕竟我的所有 Passkey 和私钥都在里面，这个可丢不得。

这里可以参考[https://bitwarden.com/help/ssh-agent/](https://bitwarden.com/help/ssh-agent/)来配置，在此不再赘述。

## 基于 SSH 的文件传输

像 Termius 这种图形化软件在传文件的时候是比较方便的，但是经过以下配置，我们的体验也能做到不相上下。

除了常见的`scp` `rsync` `sftp` 外，我们还可以用`trzsz`这个软件，这是我在去客户现场服务时，从客户运维那里看来的。它的好处是可以弹出窗口让你选择保存/发送文件的位置，比较方便；缺点是只有部分Terminal支持。

以下重点介绍`trzsz`的使用，其他的在文章最后会有简单的命令备忘，不再详述。

要使用它，你需要在客户端和服务端均安装，具体可以参考它的[GitHub页面](https://github.com/trzsz/trzsz)。

我在 Mac 上使用的是`iTerm2`，只需进行简单的配置就可以，参考
[https://trzsz.github.io/iterm2](https://trzsz.github.io/iterm2)

配置好后，使用在服务器端使用`trz`是本地发送，远端接收；`tsz`反之。
