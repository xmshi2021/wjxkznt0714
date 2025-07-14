const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

//  允许跨域
app.use(cors());
//  静态文件服务
app.use(express.static(__dirname));
//  飞书API代理
app.use('/feishu-api', createProxyMiddleware({
  target: 'https://open.feishu.cn',
  changeOrigin: true,
  pathRewrite: {'^/feishu-api': ''}
}));

//  启动服务器
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
