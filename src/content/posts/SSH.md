---
title: SSH 配置分享
published: 2025-10-30
# lang: ''
description: SSH 配置分享
---

> 阅读本文可能需要一定基础，不适合小白跟着做

之前一直在用Termius管理好多服务器，和其他诸如Xshell和FinalShell的商业软件相比，主要是看中了它的多设备SSH信息同步，也是突发奇想，看看能不能摆脱对这种软件的限制，同时体验不输Termius。

总结之后，我对新方案的要求有：
- 必须支持多设备SSH信息同步
- 必须支持SSH密钥（密码太不安全了）
- 必须支持自定义配置文件（方便管理不同服务器）
- 必须支持跨平台（如Windows、macOS、Linux等）
- 必须支持多种网络协议（如SSH、SFTP、FTP等）

那么，我们自然得出需要在系统自带的OpenSSH上入手。

## SSH信息与别名

### 配置管理

首先，OpenSSH本身就支持SSH自定义配置文件，我们可以利用这些特性来满足我们的需求。之前Termius可以添加Host，我们原版OpenSSH当然也是支持的。

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

如上面示例，我们首先配置了一些较新的后量子密钥交换算法，配置了保活包的发送间隔。之后，我们可以参考`us`这个Host来定义一个新的主机。之后，我们可以较为方便地直接连接这个主机：

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

这样的话，配置文件就变得更加模块化，便于管理和维护。且连接的时候也颇为方便，可以直接使用别名进行连接，类似于Termius的连接体验。

### 配置同步

为了满足我们将SSH配置同步到各个机器上的需求，我们采用yadm + Github的形式。

yadm是管理dotfiles的一个工具，刚好符合我们的使用场景。我们在Github上创建一个仓库，名字为`dotfiles`。

随后我们需要设置一下yadm，让他untrack某些文件（比如私钥）：

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

在另一台电脑上，我们安装好yadm后，只需`yadm clone https://github.com/{username}/dotfiles.git`克隆dotfiles仓库即可，如果做出更改，那么就重新执行`yadm add ~/.ssh && yadm commit && yadm push`，然后在其他设备上`yadm pull`，即可做到配置同步。

## SSH密钥

密码还是太不方便且太不安全了，这是不可接受的。所以我的所有服务器都使用SSH密钥进行身份验证。

——那么，SSH密钥该如何管理呢？

### SSH公钥分发

一开始考虑了很多方案，比如Ansible分发等，总感觉不太优雅。于是决定使用Github的密钥管理，让每个服务器自动从Github上拉取公钥。

格式为：
```
https://github.com/{username}.keys
```

Ubuntu发行版自带`ssh-import-id`，可以使用`ssh-import-id gh:{username}`来导入公钥。

如果你的发行版没有且你也不想安装，可以执行以下指令，其会自动将你Github账号的公钥加入到机器信任的公钥中来：

```
curl https://github.com/{username}.keys >> ~/.ssh/authorized_keys
```

如果你有需求，可以设置一个crontab计划任务，不过可能要注意旧公钥的清理。

### SSH私钥安全

最安全的实践当然是一机一钥或者使用SSH证书，这样的话如果产生泄漏事件可以第一时间做紧急措施。但是考虑到我貌似并没有如此高的安全需求，毕竟属于个人爱好者，就选择了单密钥的策略。

如何保证单密钥的安全呢？我选择了Bitwarden。

我们肯定不能把SSH私钥随时放在本地——尤其是公司的工作电脑上。所以我决定使用Vaultwarden私有化部署，并使用Bitwarden的SSH Agent功能，在SSH连接远程主机时，SSH Agent会自动读取Bitwarden密码库中的私钥，并在解锁后提供给SSH客户端，锁定后即自动禁止私钥的读取。

至于私有化部署的安全性嘛，自己的数据自己负责，我是用Docker跑的Vaultwarden服务端，然后定时任务把Docker Volume加密后上传到阿里云的OSS和Cloudflare R2存储中，保证不会丢失，毕竟我的所有Passkey和私钥都在里面，这个可丢不得。

这里可以参考[https://bitwarden.com/help/ssh-agent/](https://bitwarden.com/help/ssh-agent/)来配置，在此不再赘述。

## 基于SSH的文件传输

像Termius这种图形化软件在传文件的时候是比较方便的，但是经过以下配置，我们的体验也能做到不相上下。

除了常见的`scp` `rsync` `sftp` 外，我们还可以用`trzsz`这个软件，这是我在去客户现场服务时，从客户运维那里看来的。它的好处是可以弹出窗口让你选择保存/发送文件的位置，比较方便；缺点是只有部分Terminal支持。

以下重点介绍`trzsz`的使用，其他的在文章最后会有简单的命令备忘，不再详述。

要使用它，你需要在客户端和服务端均安装，具体可以参考它的[GitHub页面](https://github.com/trzsz/trzsz)。

我在Mac上使用的是`iTerm2`，只需进行简单的配置就可以，参考
[https://trzsz.github.io/iterm2](https://trzsz.github.io/iterm2)

配置好后，使用在服务器端使用`trz`是本地发送，远端接收；`tsz`反之。

## SSH其他命令备忘

> 注：以下内容为AIGC

| 场景               | 命令                                                                 |
|--------------------|----------------------------------------------------------------------|
| **上传文件**       | `scp /local/path/file.txt user@example.com:/remote/path/`            |
| **上传目录（递归）** | `scp -r /local/dir/ user@example.com:/remote/dir/`                 |
| **下载文件**       | `scp user@example.com:/remote/path/file.txt /local/path/`            |
| **下载目录（递归）** | `scp -r user@example.com:/remote/dir/ /local/dir/`                 |
| **指定端口 2222**  | `scp -P 2222 file.txt user@example.com:/remote/`                     |
| **使用密钥认证**   | `scp -i ~/.ssh/id_rsa file.txt user@example.com:/remote/`            |
| **保留权限/时间戳**| `scp -p file.txt user@example.com:/remote/`                          |
| **压缩传输**       | `scp -C file.txt user@example.com:/remote/`                          |
### RSYNC
| 场景                         | 命令                                                                 |
|------------------------------|----------------------------------------------------------------------|
| **同步本地 → 远程（镜像）**   | `rsync -avz /local/dir/ user@example.com:/remote/dir/`               |
| **同步远程 → 本地**           | `rsync -avz user@example.com:/remote/dir/ /local/dir/`               |
| **仅同步差异（增量）**        | `rsync -auvz /local/dir/ user@example.com:/remote/dir/`              |
| **删除远程多余文件**          | `rsync -avz --delete /local/dir/ user@example.com:/remote/dir/`      |
| **指定端口 2222**             | `rsync -avz -e "ssh -p 2222" /local/dir/ user@example.com:/remote/dir/` |
| **使用密钥**                  | `rsync -avz -e "ssh -i ~/.ssh/id_rsa" /local/ user@example.com:/remote/` |
| **显示进度**                  | `rsync -avz --progress /local/ user@example.com:/remote/`            |
| **排除文件**                  | `rsync -avz --exclude="*.log" /local/ user@example.com:/remote/`     |
### SFTP
```shell
sftp us
# 登录后常用命令：
put /local/file.txt /remote/        # 上传
get /remote/file.txt /local/        # 下载
put -r /local/dir/ /remote/         # 上传目录
get -r /remote/dir/ /local/         # 下载目录
ls                                  # 查看远程
cd /remote/path                     # 切换目录
exit                                # 退出
```
### SSH隧道

#### SSH三大隧道类型

| 场景 | 命令 | 说明 |
|------|------|------|
| **基础：暴露本地 Web** | `ssh -R 8080:localhost:3000 jump@bastion.com` | 跳板机 `8080` → 你本地 `3000` |
| **公网可访问（需配置）** | `ssh -R 0.0.0.0:8080:localhost:3000 jump@bastion.com` | 需服务器 `GatewayPorts yes` |
| **自动分配远程端口** | `ssh -R 0:localhost:3000 jump@bastion.com` | 服务器自动选端口（查看日志） |
| **后台运行** | `ssh -fN -R 8080:localhost:3000 jump@bastion.com` | 静默运行 |
| **跳板 + 远程转发** | `ssh -J jump@bastion.com -R 8080:localhost:3000 target@internal.com` | 多跳远程转发 |

#### `-L` 本地转发（Local Port Forwarding）详解
| 场景 | 命令 | 说明 |
|------|------|------|
| **基础：访问内网 Web** | `ssh -L 8080:10.0.0.100:80 jump@bastion.com` | 本地 `8080` → 跳板机 → 内网 `10.0.0.100:80` |
| **绑定本地回环（安全）** | `ssh -L 127.0.0.1:3306:db.internal:3306 jump@bastion.com` | 仅 `localhost` 可访问，防泄露 |
| **绑定所有接口（危险）** | `ssh -L 0.0.0.0:8080:web:80 jump@bastion.com` | 局域网其他人也能访问（需谨慎） |
| **后台运行 + 不执行命令** | `ssh -f -N -L 3306:10.0.0.100:3306 jump@bastion.com` | `-f` 后台，`-N` 不开 shell |
| **压缩传输** | `ssh -C -L 8080:web:80 jump@bastion.com` | 适合慢速网络 |
| **指定身份文件** | `ssh -i ~/.ssh/id_jump -L 9090:prom:9090 jump@bastion.com` | 使用特定密钥 |
| **自动重连（autossh）** | `autossh -M 0 -fN -L 3306:db:3306 jump@bastion.com` | 断线自动重连 |
| **跳板 + 本地转发** | `ssh -J jump@bastion.com -L 3306:10.0.0.100:3306 target@internal.com` | 一键跳板 + 隧道 |

#### `-R` 远程转发（Remote Port Forwarding）详解
| 场景 | 命令 | 说明 |
|------|------|------|
| **基础：暴露本地 Web** | `ssh -R 8080:localhost:3000 jump@bastion.com` | 跳板机 `8080` → 你本地 `3000` |
| **公网可访问（需配置）** | `ssh -R 0.0.0.0:8080:localhost:3000 jump@bastion.com` | 需服务器 `GatewayPorts yes` |
| **自动分配远程端口** | `ssh -R 0:localhost:3000 jump@bastion.com` | 服务器自动选端口（查看日志） |
| **后台运行** | `ssh -fN -R 8080:localhost:3000 jump@bastion.com` | 静默运行 |
| **跳板 + 远程转发** | `ssh -J jump@bastion.com -R 8080:localhost:3000 target@internal.com` | 多跳远程转发 |

服务器配置要求（`/etc/ssh/sshd_config`）：
```
GatewayPorts yes
```
然后重启 SSH 服务：
```
sudo systemctl restart sshd
```

#### `-D` 动态转发（SOCKS5 代理）详解
| 场景 | 命令 | 说明 |
|------|------|------|
| **基础 SOCKS5 代理** | `ssh -D 1080 jump@bastion.com` | 本地 `1080` 成 SOCKS5 代理 |
| **仅本地回环** | `ssh -D 127.0.0.1:1080 jump@bastion.com` | 安全，防止泄露 |
| **后台运行** | `ssh -fN -D 1080 jump@bastion.com` | 静默代理 |
| **跳板 + 动态代理** | `ssh -J jump@bastion.com -D 1080 target@internal.com` | 内网全网代理 |
| **浏览器配置** | Firefox → 网络设置 → 手动代理 → SOCKS Host: `127.0.0.1` Port: `1080` | 勾选“通过 SOCKS 代理 DNS” |
| **curl 使用代理** | `curl --socks5-hostname 127.0.0.1:1080 https://ifconfig.me` | `-hostname` 解析 DNS 在远程 |
| **git 全局代理** | `git config --global http.proxy socks5h://127.0.0.1:1080` | `socks5h` 远程解析 DNS |

#### 跳板机组合（`-J` / ProxyJump）

| 场景 | 命令 | 说明 |
|------|------|------|
| **单跳板登录** | `ssh -J jump@bastion.com target@internal.com` | 推荐方式 |
| **多跳板** | `ssh -J jump1@bastion1.com,jump2@bastion2.com target@final.com` | 链式跳转 |
| **配置文件等价** | `ProxyJump jump@bastion.com` | 放 `~/.ssh/config` |
| **跳板 + 本地转发** | `ssh -J jump@bastion.com -L 3306:db:3306 target@internal.com` | 一条命令搞定 |
| **跳板 + 动态代理** | `ssh -J jump@bastion.com -D 1080 target@internal.com` | 内网全代理 |

#### `~/.ssh/config` 配置文件模板
```bash
# ~/.ssh/config  (chmod 600)

Host bastion
    HostName bastion.example.com
    User jump
    Port 22
    IdentityFile ~/.ssh/id_bastion

Host db-tunnel
    HostName db.internal.com
    User app
    ProxyJump bastion
    LocalForward 3306 127.0.0.1:3306
    ExitOnForwardFailure yes

Host web-tunnel
    HostName web.internal.com
    User dev
    ProxyJump bastion
    LocalForward 8080 10.0.0.100:80

Host socks
    HostName bastion.example.com
    User jump
    DynamicForward 1080
    ExitOnForwardFailure yes
```
使用：
```shell
ssh db-tunnel    # 自动建 MySQL 隧道
ssh web-tunnel   # 自动建 Web 隧道
ssh socks        # 自动开 SOCKS 代理
```
#### 常用选项速查表

| 选项 | 含义 | 示例 |
|------|------|------|
| `-L [bind]:local_port:remote_host:remote_port` | 本地转发 | `-L 8080:web:80` |
| `-R [bind]:remote_port:local_host:local_port` | 远程转发 | `-R 8080:localhost:3000` |
| `-D [bind]:local_port` | 动态 SOCKS5 | `-D 1080` |
| `-f` | 后台运行 | |
| `-N` | 不执行远程命令（仅隧道） | |
| `-C` | 启用压缩 | |
| `-J user@host` | 跳板机 | `-J jump@bastion.com` |
| `-o ProxyJump=user@host` | 同 `-J` | |
| `-i keyfile` | 指定密钥 | `-i ~/.ssh/id_rsa` |
| `-p port` | SSH 端口 | `-p 2222` |
| `-M 0` | autossh 监控端口（0=禁用） | |
| `-o ExitOnForwardFailure=yes` | 端口占用时退出 | |
