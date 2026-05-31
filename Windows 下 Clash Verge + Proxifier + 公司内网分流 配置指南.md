# Windows 下 Clash Verge + Proxifier + 公司内网分流配置指南

## 1. 目标

本方案用于解决以下场景：

1. 在公司内网或开启公司 VPN 时，可以正常访问 CNPC / PetroChina / 公司内网地址。
2. Clash Verge 系统代理保持开启，保证浏览器和普通软件可以正常访问外网。
3. 公司内网地址不进入 Clash 代理，避免 DNS 解析失败。
4. Proxifier 负责开发工具的精确分流。
5. GitHub、Claude 官方、OpenAI、npm、外网 MCP 等走个人代理。
6. Claude Code 公司 API 走公司内网直连。
7. 避免 Clash、Proxifier、公司 VPN、浏览器互相冲突。

---

## 2. 最终推荐架构

最终采用：

```text
Clash Verge 系统代理 + Clash Bypass + Clash DIRECT 规则 + Proxifier 精确分流
```

整体分工如下：

```text
浏览器普通外网
    -> Clash Verge 系统代理
    -> Clash 节点
    -> 外网
```

```text
CNPC / PetroChina / 公司内网地址
    -> Clash 系统代理 Bypass
    -> 直接走公司内网 / 公司 VPN DNS
```

```text
GitHub / Claude 官方 / OpenAI / npm / 外网 MCP
    -> Proxifier
    -> 127.0.0.1:7897
    -> Clash 节点
    -> 外网
```

```text
Claude Code 公司 API
    -> e.cnpc.com.cn
    -> Proxifier Direct
    -> 公司内网 / 公司 VPN
```

---

## 3. 关键结论

本方案不是纯 Proxifier 模式。

之前尝试关闭 Clash Verge 系统代理后，虽然 `127.0.0.1:7897` 仍然可用，但浏览器和普通软件不会自动使用 Clash，因此普通外网会断。

所以最终状态是：

```text
Clash Verge 系统代理：开启
Clash Verge TUN / 虚拟网卡：关闭
Clash Verge 局域网连接：关闭
Clash Verge 端口：7897
Proxifier：开启
Proxifier default：Direct
```

公司内网地址需要同时配置在：

```text
1. Clash 订阅规则 Prepend DIRECT
2. Clash 系统代理 Bypass
3. Proxifier Direct 规则
```

其中对浏览器最关键的是：

```text
Clash 系统代理 Bypass
```

---

## 4. 公司内网直连地址

当前公司内网直连地址如下：

```text
10.*; 11.*; *.cnpc; *.cnpc.com.cn; *.petrochina; 127.0.0.1; 192.168.*; e.cnpc.com.cn
```

建议完整扩展为：

```text
localhost; 127.0.0.1; ::1; 10.*; 11.*; 192.168.*; *.cnpc; *.cnpc.com.cn; cnpc.com.cn; e.cnpc.com.cn; aigateway.devcloud.cnpc; *.petrochina; *.petrochina.com.cn; petrochina.com.cn
```

说明：

```text
*.cnpc                     匹配 aigateway.devcloud.cnpc 这类公司内部短后缀域名
*.cnpc.com.cn              匹配 xxx.cnpc.com.cn
cnpc.com.cn                匹配根域名 cnpc.com.cn
e.cnpc.com.cn              Claude Code 公司 API 主机名
aigateway.devcloud.cnpc    公司内网 AI 网关
*.petrochina               匹配 xxx.petrochina
*.petrochina.com.cn        匹配 xxx.petrochina.com.cn
```

Claude Code 公司 API 地址：

```text
https://e.cnpc.com.cn/klzm-ai-proxy/anthropic
```

注意：

```text
Proxifier / Clash 规则里只填写域名 e.cnpc.com.cn，不填写完整 URL 路径。
Claude Code 的 API Base URL 才填写完整地址：
https://e.cnpc.com.cn/klzm-ai-proxy/anthropic
```

---

## 5. Clash Verge 基础设置

进入：

```text
设置
```

推荐状态：

```text
系统代理：开启
虚拟网卡模式 / TUN：关闭
局域网连接：关闭
DNS 覆写：关闭
IPv6：可保持当前状态
统一延迟：可保持当前状态
端口设置：7897
```

也就是：

```text
System Proxy: On
TUN Mode: Off
Allow LAN: Off
Port: 7897
```

说明：

```text
系统代理开启后，浏览器和普通软件会自动使用 Clash。
TUN 关闭，避免和公司 VPN 抢路由。
局域网连接关闭，避免本机代理暴露给局域网。
```

---

## 6. Clash 订阅规则配置

### 6.1 为什么要配置 Clash 规则

当 Clash 系统代理开启后，浏览器访问公司内网地址时，请求会先进入 Clash。

如果 Clash 不知道这些域名应该 DIRECT，就可能错误走代理节点。

之前的失败日志：

```text
[TCP] dial DIRECT (match DomainSuffix/cnpc) 127.0.0.1:53735 --> aigateway.devcloud.cnpc:8443 error: dns resolve failed: couldn't find ip
```

说明：

```text
Clash 规则已经命中 DIRECT
但 Clash 自己解析不了公司内网 DNS
```

所以除了 DIRECT 规则外，还必须配置系统代理 Bypass。

---

### 6.2 在订阅规则 Prepend 中添加 DIRECT 规则

进入：

```text
配置 / Profiles
  -> 找到当前使用的订阅
  -> 右键
  -> 编辑规则 / Edit Rules
  -> Prepend / 前置规则
```

添加以下规则：

```yaml
DOMAIN,aigateway.devcloud.cnpc,DIRECT
DOMAIN,e.cnpc.com.cn,DIRECT
DOMAIN-SUFFIX,cnpc,DIRECT
DOMAIN-SUFFIX,cnpc.com.cn,DIRECT
DOMAIN-SUFFIX,petrochina,DIRECT
DOMAIN-SUFFIX,petrochina.com.cn,DIRECT
IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
IP-CIDR,11.0.0.0/8,DIRECT,no-resolve
IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
```

如果界面要求带 `-`，则使用：

```yaml
- DOMAIN,aigateway.devcloud.cnpc,DIRECT
- DOMAIN,e.cnpc.com.cn,DIRECT
- DOMAIN-SUFFIX,cnpc,DIRECT
- DOMAIN-SUFFIX,cnpc.com.cn,DIRECT
- DOMAIN-SUFFIX,petrochina,DIRECT
- DOMAIN-SUFFIX,petrochina.com.cn,DIRECT
- IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
- IP-CIDR,11.0.0.0/8,DIRECT,no-resolve
- IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
- IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
```

说明：

```text
必须放在 Prepend / 前置规则。
不要放到 Append / 后置规则。
很多订阅最后有 MATCH 规则，后置规则可能永远不会生效。
```

---

## 7. Clash 系统代理 Bypass 配置

### 7.1 为什么 Bypass 最关键

对于浏览器访问公司内网地址，最理想的情况不是：

```text
进入 Clash -> Clash 判断 DIRECT -> Clash 自己解析 DNS
```

而是：

```text
浏览器 -> 系统代理 Bypass -> 直接走公司内网 / 公司 VPN DNS
```

这样可以避免 Clash 自己解析 `.cnpc` 内部域名失败。

---

### 7.2 配置入口

进入 Clash Verge：

```text
设置
  -> 系统代理 右侧齿轮
  -> 绕过列表 / Bypass / Proxy Bypass
```

添加：

```text
localhost; 127.0.0.1; ::1; 10.*; 11.*; 192.168.*; *.cnpc; *.cnpc.com.cn; cnpc.com.cn; e.cnpc.com.cn; aigateway.devcloud.cnpc; *.petrochina; *.petrochina.com.cn; petrochina.com.cn
```

保存后执行：

```text
关闭系统代理
重新开启系统代理
重启浏览器或重新打开目标页面
```

---

### 7.3 正确效果

访问：

```text
https://aigateway.devcloud.cnpc:8443/
```

正确情况是：

```text
Clash 日志里不再出现 aigateway.devcloud.cnpc
```

或者至少不再出现：

```text
dns resolve failed
```

最理想状态：

```text
公司内网域名完全绕过 Clash
直接由公司网络 / VPN DNS 解析
```

---

## 8. Proxifier 基础配置

### 8.1 添加 Clash 本地代理

打开 Proxifier：

```text
Profile
  -> Proxy Servers
  -> Add
```

填写：

```text
Address: 127.0.0.1
Port: 7897
Protocol: HTTP
```

名称建议：

```text
Clash-HTTP-7897
```

---

### 8.2 Proxifier 规则总顺序

进入：

```text
Profile
  -> Proxification Rules
```

保留默认规则：

```text
localhost
default
```

最终规则建议顺序：

```text
localhost
CNPC-Intranet-DIRECT
CNPC-Git-DIRECT
CNPC-LLM-DIRECT
Claude-Official-Proxy
GitHub-Proxy
Node-Package-Proxy
Codex-OpenAI-Proxy
Google-YouTube-Proxy
default
```

说明：

```text
Proxifier 从上到下匹配。
DIRECT 规则必须在代理规则上方。
default 放最后。
```

---

## 9. Proxifier 规则详细配置

### 9.1 localhost 规则

默认 localhost 规则保留在最上方。

建议内容：

```text
Name:
localhost

Target hosts:
localhost; 127.0.0.1; ::1

Action:
Direct
```

---

### 9.2 CNPC-Intranet-DIRECT

用途：

```text
所有 CNPC / PetroChina / 公司内网地址强制直连。
```

配置：

```text
Name:
CNPC-Intranet-DIRECT

Applications:
Any

Target hosts:
localhost; 127.0.0.1; ::1; 10.*; 11.*; 192.168.*; *.cnpc; *.cnpc.com.cn; cnpc.com.cn; e.cnpc.com.cn; aigateway.devcloud.cnpc; *.petrochina; *.petrochina.com.cn; petrochina.com.cn

Target ports:
Any

Action:
Direct
```

---

### 9.3 CNPC-Git-DIRECT

用途：

```text
公司 Git 仓库强制直连。
```

配置：

```text
Name:
CNPC-Git-DIRECT

Applications:
git.exe; ssh.exe; plink.exe; Code.exe; Cursor.exe; SourceTree.exe; idea64.exe

Target hosts:
*.cnpc; *.cnpc.com.cn; cnpc.com.cn; e.cnpc.com.cn; aigateway.devcloud.cnpc; *.petrochina; *.petrochina.com.cn; petrochina.com.cn

Target ports:
22; 80; 443; 8080; 8443

Action:
Direct
```

说明：

```text
公司 Git 不要走个人代理。
否则可能出现认证失败、IP 白名单失败、push 失败、DNS 解析失败。
```

---

### 9.4 CNPC-LLM-DIRECT

用途：

```text
Claude Code 公司 API 强制直连。
```

Claude Code 公司 API：

```text
https://e.cnpc.com.cn/klzm-ai-proxy/anthropic
```

Proxifier 里只填写主机名：

```text
e.cnpc.com.cn
```

配置：

```text
Name:
CNPC-LLM-DIRECT

Applications:
claude.exe; node.exe; npm.exe; npx.exe; Code.exe; Cursor.exe; powershell.exe; cmd.exe

Target hosts:
e.cnpc.com.cn; aigateway.devcloud.cnpc; *.cnpc; *.cnpc.com.cn; cnpc.com.cn; *.petrochina; *.petrochina.com.cn; petrochina.com.cn

Target ports:
443; 8443; 8080

Action:
Direct
```

说明：

```text
Claude Code 使用公司 API 时必须 Direct。
Direct 后由公司内网或公司 VPN 接管。
```

---

### 9.5 Claude-Official-Proxy

用途：

```text
Claude Code 更新、Claude 官方 API、Anthropic 官方域名走个人代理。
```

配置：

```text
Name:
Claude-Official-Proxy

Applications:
claude.exe; node.exe; npm.exe; npx.exe; curl.exe; powershell.exe; cmd.exe

Target hosts:
downloads.claude.ai; *.claude.ai; claude.ai; api.anthropic.com; *.anthropic.com; storage.googleapis.com

Target ports:
443

Action:
Clash-HTTP-7897
```

说明：

```text
claude update、Claude Code release 下载、Anthropic 官方 API 走 Clash。
```

---

### 9.6 GitHub-Proxy

用途：

```text
GitHub 访问、push、pull、fetch 走 Clash。
```

配置：

```text
Name:
GitHub-Proxy

Applications:
git.exe; ssh.exe; plink.exe; Code.exe; Cursor.exe; SourceTree.exe; idea64.exe

Target hosts:
github.com; ssh.github.com; *.github.com; *.githubusercontent.com; *.githubassets.com; raw.githubusercontent.com; objects.githubusercontent.com; gist.github.com

Target ports:
22; 443

Action:
Clash-HTTP-7897
```

---

### 9.7 Node-Package-Proxy

用途：

```text
npm / npx / pnpm / yarn 外网包下载走 Clash。
```

配置：

```text
Name:
Node-Package-Proxy

Applications:
node.exe; npm.exe; npx.exe; pnpm.exe; yarn.exe; corepack.exe

Target hosts:
registry.npmjs.org; *.npmjs.org; *.npmjs.com; registry.yarnpkg.com; *.github.com; raw.githubusercontent.com

Target ports:
80; 443

Action:
Clash-HTTP-7897
```

---

### 9.8 Codex-OpenAI-Proxy

用途：

```text
Codex / OpenAI / ChatGPT 相关域名走 Clash。
```

配置：

```text
Name:
Codex-OpenAI-Proxy

Applications:
codex.exe; node.exe; npm.exe; npx.exe; python.exe; powershell.exe; cmd.exe; Code.exe; Cursor.exe

Target hosts:
api.openai.com; *.openai.com; chatgpt.com; *.chatgpt.com; auth.openai.com

Target ports:
443

Action:
Clash-HTTP-7897
```

---

### 9.9 Google-YouTube-Proxy

用途：

```text
Google / YouTube 走 Clash。
```

配置：

```text
Name:
Google-YouTube-Proxy

Applications:
chrome.exe; msedge.exe; firefox.exe; Code.exe; Cursor.exe

Target hosts:
*.google.com; google.com; *.googleapis.com; *.gstatic.com; *.googleusercontent.com; *.youtube.com; youtube.com; *.ytimg.com; *.ggpht.com

Target ports:
443

Action:
Clash-HTTP-7897
```

说明：

```text
浏览器普通外网主要已经由 Clash 系统代理负责。
这条规则可以作为补充，但不是必须。
```

---

## 10. default 规则

推荐日常状态：

```text
default -> Direct
```

最终规则顺序：

```text
localhost                  Direct
CNPC-Intranet-DIRECT        Direct
CNPC-Git-DIRECT             Direct
CNPC-LLM-DIRECT             Direct
Claude-Official-Proxy       Clash-HTTP-7897
GitHub-Proxy                Clash-HTTP-7897
Node-Package-Proxy          Clash-HTTP-7897
Codex-OpenAI-Proxy          Clash-HTTP-7897
Google-YouTube-Proxy        Clash-HTTP-7897
default                    Direct
```

说明：

```text
不要把 Proxifier default 设置成代理。
普通外网已经由 Clash 系统代理负责。
Proxifier default 设置为代理，容易造成重复代理或混乱。
```

---

## 11. GitHub / 公司 Git 配置建议

### 11.1 清理 Git 全局代理

不要长期设置：

```bat
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
```

建议清理：

```bat
git config --global --unset http.proxy
git config --global --unset https.proxy
```

查看是否还有代理残留：

```bat
git config --show-origin --get-regexp "http.*proxy|https.*proxy|remote\..*\.proxy"
```

---

### 11.2 只给 GitHub 配代理

```bat
git config --global http.https://github.com.proxy http://127.0.0.1:7897
git config --global http.https://gist.github.com.proxy http://127.0.0.1:7897
```

可选：

```bat
git config --global http.https://raw.githubusercontent.com.proxy http://127.0.0.1:7897
```

---

### 11.3 公司 Git 禁用代理

```bat
git config --global http.https://e.cnpc.com.cn.proxy ""
git config --global http.https://cnpc.com.cn.proxy ""
git config --global http.https://petrochina.com.cn.proxy ""
```

如果有具体公司 Git 域名，例如：

```text
git.xxx.cnpc.com.cn
code.xxx.cnpc.com.cn
git.xxx.petrochina.com.cn
```

则额外添加：

```bat
git config --global http.https://git.xxx.cnpc.com.cn.proxy ""
git config --global http.https://code.xxx.cnpc.com.cn.proxy ""
git config --global http.https://git.xxx.petrochina.com.cn.proxy ""
```

---

### 11.4 SourceTree 设置

建议 SourceTree 使用 System Git：

```text
Tools
  -> Options
  -> Git
  -> Use System Git
```

检查：

```bat
where git
git --version
```

目标：

```text
SourceTree、VS Code、CMD、PowerShell 尽量使用同一个 Git。
```

---

## 12. Claude Code 公司 API 配置说明

Claude Code 公司 API 地址：

```text
https://e.cnpc.com.cn/klzm-ai-proxy/anthropic
```

应配置为：

```text
ANTHROPIC_BASE_URL=https://e.cnpc.com.cn/klzm-ai-proxy/anthropic
```

代理层面：

```text
e.cnpc.com.cn 必须 Direct
```

不要把完整 URL 写进 Proxifier 或 Clash 规则。

正确写法：

```text
e.cnpc.com.cn
```

错误写法：

```text
https://e.cnpc.com.cn/klzm-ai-proxy/anthropic
```

---

## 13. 验证清单

### 13.1 验证 Clash 代理端口可用

即使关闭系统代理，Clash 本地端口也应该可以手动访问：

```bat
curl -vI --proxy http://127.0.0.1:7897 https://github.com
```

成功特征：

```text
CONNECT github.com:443 HTTP/1.1
HTTP/1.1 200 Connection established
HTTP/1.1 200 OK
```

这说明：

```text
Clash Core 正常
127.0.0.1:7897 正常
```

---

### 13.2 验证公司内网地址

```bat
curl -vI https://aigateway.devcloud.cnpc:8443/
curl -vI https://e.cnpc.com.cn
```

注意：

```text
公司内网地址可能禁 ping。
curl / 浏览器测试更有参考意义。
```

---

### 13.3 验证 Clash 日志

访问：

```text
https://aigateway.devcloud.cnpc:8443/
```

理想情况：

```text
Clash 日志里不出现 aigateway.devcloud.cnpc
```

这说明系统代理 Bypass 生效，公司内网地址完全绕过 Clash。

如果出现：

```text
match DomainSuffix/cnpc DIRECT
dns resolve failed
```

说明：

```text
Clash 规则生效了
但系统代理 Bypass 没生效
请求仍然进入了 Clash
Clash 自己解析不了公司内网 DNS
```

处理：

```text
检查系统代理 Bypass 是否包含：
aigateway.devcloud.cnpc; *.cnpc; e.cnpc.com.cn
```

---

### 13.4 验证 Proxifier 日志

期望结果：

```text
e.cnpc.com.cn                              -> Direct
aigateway.devcloud.cnpc                    -> Direct
xxx.cnpc.com.cn                            -> Direct
xxx.petrochina.com.cn                      -> Direct
downloads.claude.ai                        -> Clash-HTTP-7897
github.com                                 -> Clash-HTTP-7897
raw.githubusercontent.com                  -> Clash-HTTP-7897
api.openai.com                             -> Clash-HTTP-7897
```

---

### 13.5 验证 GitHub

```bat
git ls-remote https://github.com/owner/repo.git
git fetch -v
git push -v
```

期望：

```text
GitHub 相关流量走 Clash-HTTP-7897
公司 Git 相关流量 Direct
```

---

## 14. 常见问题排查

### 14.1 公司内网地址打不开，但关闭 Clash 系统代理后可以打开

原因：

```text
公司内网地址进入了 Clash
Clash 无法解析公司内网 DNS
```

处理：

```text
1. 确认 Clash 系统代理 Bypass 已加入公司内网地址。
2. 确认 Clash 订阅规则 Prepend 已加入 DIRECT 规则。
3. 确认 Proxifier Direct 规则包含该域名。
4. 关闭再开启 Clash 系统代理。
5. 重启浏览器。
```

---

### 14.2 Clash 日志显示 DIRECT，但仍然 DNS 失败

典型日志：

```text
dial DIRECT (match DomainSuffix/cnpc) ... error: dns resolve failed
```

原因：

```text
Clash 规则已经命中 DIRECT
但请求仍进入 Clash
Clash 自己无法解析 .cnpc 内部域名
```

解决：

```text
把该域名加入 Clash 系统代理 Bypass。
目标是让它根本不要进入 Clash。
```

---

### 14.3 Proxifier 看不到浏览器访问的公司内网域名

原因：

```text
浏览器优先读取 Windows 系统代理
请求直接进入 Clash 127.0.0.1:7897
Proxifier 看到的可能只是 127.0.0.1:7897
而不是最终目标域名
```

处理：

```text
浏览器公司内网分流主要靠 Clash 系统代理 Bypass。
Proxifier 主要负责开发工具精确分流。
```

---

### 14.4 关闭 Clash 系统代理后普通外网断了

原因：

```text
浏览器和普通软件不再自动使用 127.0.0.1:7897
```

这不代表 Clash Core 关闭。

验证：

```bat
curl -vI --proxy http://127.0.0.1:7897 https://github.com
```

如果成功，说明：

```text
Clash Core 仍然正常
只是普通应用没有自动走系统代理
```

最终建议：

```text
保持 Clash 系统代理开启。
```

---

### 14.5 GitHub push 有时失败

常见原因：

```text
1. VS Code、SourceTree、CMD 使用的不是同一个 Git。
2. SourceTree 使用 Embedded Git。
3. GitHub remote 有时是 HTTPS，有时是 SSH。
4. Git 全局代理污染公司 Git。
5. ssh.exe / plink.exe 没有被 Proxifier 接管。
```

检查：

```bat
where git
git --version
git remote -v
git config --show-origin --get-regexp "http.*proxy|https.*proxy|remote\..*\.proxy"
```

建议：

```bat
git config --global --unset http.proxy
git config --global --unset https.proxy
git config --global http.https://github.com.proxy http://127.0.0.1:7897
```

---

## 15. 最小可执行配置

当前最小可执行版本如下：

### Clash Verge

```text
系统代理：开启
TUN / 虚拟网卡：关闭
局域网连接：关闭
端口：7897
```

### Clash 订阅规则 Prepend

```yaml
DOMAIN,aigateway.devcloud.cnpc,DIRECT
DOMAIN,e.cnpc.com.cn,DIRECT
DOMAIN-SUFFIX,cnpc,DIRECT
DOMAIN-SUFFIX,cnpc.com.cn,DIRECT
DOMAIN-SUFFIX,petrochina,DIRECT
DOMAIN-SUFFIX,petrochina.com.cn,DIRECT
IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
IP-CIDR,11.0.0.0/8,DIRECT,no-resolve
IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
```

### Clash 系统代理 Bypass

```text
localhost; 127.0.0.1; ::1; 10.*; 11.*; 192.168.*; *.cnpc; *.cnpc.com.cn; cnpc.com.cn; e.cnpc.com.cn; aigateway.devcloud.cnpc; *.petrochina; *.petrochina.com.cn; petrochina.com.cn
```

### Proxifier

```text
localhost                  Direct
CNPC-Intranet-DIRECT        Direct
CNPC-Git-DIRECT             Direct
CNPC-LLM-DIRECT             Direct
Claude-Official-Proxy       Clash-HTTP-7897
GitHub-Proxy                Clash-HTTP-7897
Node-Package-Proxy          Clash-HTTP-7897
Codex-OpenAI-Proxy          Clash-HTTP-7897
default                    Direct
```

---

## 16. 最终推荐状态

日常使用保持：

```text
公司内网 / 公司 VPN：需要时开启
Clash Verge：开启
Clash 系统代理：开启
Clash TUN：关闭
Clash 局域网连接：关闭
Clash 端口：7897
Proxifier：开启
Proxifier default：Direct
```

公司内网地址：

```text
localhost; 127.0.0.1; ::1; 10.*; 11.*; 192.168.*; *.cnpc; *.cnpc.com.cn; cnpc.com.cn; e.cnpc.com.cn; aigateway.devcloud.cnpc; *.petrochina; *.petrochina.com.cn; petrochina.com.cn
```

必须同时存在于：

```text
Clash 订阅规则 Prepend DIRECT
Clash 系统代理 Bypass
Proxifier Direct 规则
```

最终目标：

```text
浏览器普通外网：走 Clash 系统代理
浏览器公司内网：走 Clash Bypass，完全绕过 Clash
开发工具外网：走 Proxifier -> Clash-HTTP-7897
开发工具公司内网：走 Proxifier Direct
Claude Code 公司 API：走 e.cnpc.com.cn Direct
GitHub / Claude 官方 / OpenAI / npm：走 Clash-HTTP-7897
```
