// AI文案改写工具 - 真实API集成版本
class AIRewriteApp {
    constructor() {
        this.currentUser = null;
        this.currentTab = 'prompts';
        this.prompts = [];
        this.workflows = [];
        this.models = [];
        this.accounts = [];
        this.feishuToken = null;
        this.cozeToken = null;
        this.tokenExpiry = null;
        this.darkMode = localStorage.getItem('darkMode') === 'true';        // 添加配色主题模式状态
        
        // API配置
        this.feishuConfig = {
            appId: 'cli_a8fa027145d8d00e',
            appSecret: 'A9BfoMcwp9QupNgQXrc6YbJkpoaLNCZi',
            baseUrl: 
            //'http://localhost:3005/feishu-api' 
            //'https://open.feishu.cn/open-apis',
            // https://feishu-api-proxy.shixianmu.workers.dev/feishu-api' 
            //'https://feishu-api-proxy.shixianmu.workers.dev/feishu-api/open-apis' // 合并为完整URL
            '/feishu-api/open-apis'// 修改为相对路径
            //'http://localhost:3000/feishu-api'//指向代理服务器
            //'https://open.feishu.cn/open-apis'
        };
        
        this.cozeConfig = {
            baseUrl: 'https://api.coze.cn/v1',
            //workflowId: '7525331144461369371'
        };
        
        // 电子表格配置
        this.spreadsheetConfig = {
            spreadsheetToken: 'X9jJsmqKkhtjGitvDSIcAXCLnfd',
            spreadsheetToken_write: 'QZPIsqiOOhZ4BNtI0bjcYfnbnh5',
            sheets: {
                prompts: 'dcb498',    // 提示词库
                workflows: 'oPjKcK',   // 工作流ID
                tokens: 'BIR0MF',      // 令牌信息
                accounts: 'jxmojZ',    // 账号信息
                models: 'OXDxH8',      // 模型列表
                results: '340c75'       // 保存结果 spreadsheetToken_write
            }
        };
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.initializeData();
        //this.showLoginPage();
        this.applyDarkMode();        // 应用保存的主题模式
        const savedSheetUrl = localStorage.getItem('saveSheetUrl');        // 新增：加载保存的设置
        if (savedSheetUrl) {
            document.getElementById('saveSheetUrl').value = savedSheetUrl;
        }

        // 尝试从本地存储恢复登录状态
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
        await this.loadUserData();
        this.showMainApp();
    } else {
        this.showLoginPage();
    }
    }

    // 添加主题切换相关方法
    applyDarkMode() {
        if (this.darkMode) {
            document.documentElement.classList.add('dark-mode');
            document.getElementById('themeToggle')?.setAttribute('checked', true);
        } else {
            document.documentElement.classList.remove('dark-mode');
            document.getElementById('themeToggle')?.removeAttribute('checked');
        }
    }

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('darkMode', this.darkMode);
        this.applyDarkMode();
    }

    // 添加退出登录方法
    logout() {
        // 清除用户状态
        this.currentUser = null;
        this.feishuToken = null;
        this.tokenExpiry = null;
        
        // 清除本地存储
        localStorage.removeItem('currentUser');

        // 清除登录表单
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';

        // 切换到登录页面
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('loginPage').classList.remove('hidden');
        
        // 显示退出成功提示
        this.showNotification('已成功退出登录', 'success');
    }


    // 初始化数据 - 获取飞书访问令牌
    async initializeData() {
        try {
            await this.getFeishuAccessToken();
            await this.loadAccountsData();
        } catch (error) {
            console.error('初始化失败:', error);
            this.showNotification('系统初始化失败，请稍后重试', 'error');
        }
    }

    // 获取飞书访问令牌
    async getFeishuAccessToken() {
        try {
            //const response = await fetch(`${this.feishuConfig.baseUrl}/get-tenant-access-token`, { //            // 必须使用后端提供的代理接口
            //const response = await fetch(`${this.feishuConfig.baseUrl}/get-tenant-access-token`, {
            //const response = await fetch(`${this.feishuConfig.baseUrl}/auth/v3/tenant_access_token/internal`, {
            //const response = await fetch(`${API_BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`, {
            //const response = await fetch( 'https://feishu-api-proxy.shixianmu.workers.dev/feishu-api',{
            const response = await fetch('/feishu-api/open-apis/auth/v3/tenant_access_token/internal', {
            //const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            //const response = await fetch(`${this.feishuConfig.baseUrl}/auth/v3/tenant_access_token/internal`, {
            //mode: 'cors', // 明确设置CORS模式
            //credentials: 'include', // 如果需要携带凭证    
            method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    //app_id: this.appId,
                    //app_secret: this.appSecret

                    app_id: this.feishuConfig.appId,
                    app_secret: this.feishuConfig.appSecret,
                    grant_type: 'client_credentials'
                })
            });
            
            if (!response.ok) {
                throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.code === 0) {
                this.feishuToken = data.tenant_access_token;
                console.log('飞书访问令牌获取成功');
            } else {
                throw new Error(`获取飞书令牌失败: ${data.msg}`);
            }
        } catch (error) {
            console.error('获取飞书访问令牌失败:', error);
            throw error;
        }
    }

    // 加载账号数据
    async loadAccountsData() {
        try {
            const accounts = await this.getSpreadsheetData(this.spreadsheetConfig.sheets.accounts, 'A:C');
            this.accounts = accounts.slice(1).map(row => ({
                description: row[0] || '',
                username: row[1] || '',
                password: row[2] || ''
            })).filter(account => account.username && account.password);
            
            console.log('账号数据加载成功:', this.accounts.length, '个账号');
        } catch (error) {
            console.error('加载账号数据失败:', error);
            throw error;
        }
    }

    // 通用获取电子表格数据方法
    async getSpreadsheetData(sheetId, range) {
        try {
            const url = `${this.feishuConfig.baseUrl}/sheets/v2/spreadsheets/${this.spreadsheetConfig.spreadsheetToken}/values/${sheetId}!${range}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.feishuToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
            const errorDetails = await response.text().catch(() => '无法获取错误详情');
            throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorDetails}`);
            }


            const data = await response.json();
            
            if (data.code === 0) {
                return data.data.valueRange.values || [];
            } else {
                throw new Error(`获取表格数据失败: ${data.msg}`);
            }
        } catch (error) {
            console.error('获取电子表格数据失败:', error);
            throw error;
        }
    }

    // 登录处理
    async handleLogin() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!username || !password) {
            this.showNotification('请输入用户名和密码', 'error');
            return;
        }

        try {
            // 验证账号
            const user = this.accounts.find(u => u.username === username && u.password === password);
            
            if (user) {
                this.currentUser = user;
                localStorage.setItem('currentUser', JSON.stringify(user));// 保存用户信息到本地存储
                await this.loadUserData();
                this.showMainApp();
                this.showNotification('登录成功！', 'success');
            } else {
                this.showNotification('用户名或密码错误', 'error');
            }
        } catch (error) {
            console.error('登录失败:', error);
            this.showNotification('登录失败，请重试', 'error');
        }
    }

    // 加载用户相关数据
    async loadUserData() {
        try {
            this.showLoading();

            // 使用Promise.allSettled替代Promise.all，允许部分失败
            const results = await Promise.allSettled([
                this.loadTokenData(),
                this.loadPromptsData(),
                this.loadWorkflowsData(),
                this.loadModelsData()
            ]);

            // 处理成功和失败的请求
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`数据加载失败[${index}]:`, result.reason);
                }
            });

            // 并行加载多个数据源
            //await Promise.all([
             //   this.loadTokenData(),
                //this.loadPromptsData(),
                //this.loadWorkflowsData(),
                //this.loadModelsData()
            //]);
            
            this.updateTokenInfo();
            this.populateSelects();
            // 添加提示词列表渲染
            this.renderPrompts(); // ✅ 新增这一行
            
        } catch (error) {
            console.error('加载用户数据失败:', error);
            this.showNotification('数据加载失败', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 加载令牌数据
    async loadTokenData() {
        try {
            const tokenData = await this.getSpreadsheetData(this.spreadsheetConfig.sheets.tokens, 'B2:C2');
            if (tokenData.length > 0) {
                this.cozeToken = tokenData[0][0] || '';
                this.tokenExpiry = tokenData[0][1] || '';
            }
        } catch (error) {
            console.error('加载令牌数据失败:', error);
            throw error; // 新增：重新抛出错误以便上层处理
        }
    }

    // 加载提示词数据
    async loadPromptsData() {
        try {
            const promptsData = await this.getSpreadsheetData(this.spreadsheetConfig.sheets.prompts, 'A:D');
            this.prompts = promptsData.slice(1).map((row, index) => ({
                id: index + 1,
                name: row[0] || '',
                content: row[1] || '',
                author: row[2] || '',
                visibility: row[3] || '仅作者',
                rowIndex: index + 2 // 电子表格行号（从2开始，因为第1行是标题）
            })).filter(prompt => prompt.name && prompt.content);
            
            console.log('提示词数据加载成功:', this.prompts.length, '个提示词');
        } catch (error) {
            console.error('加载提示词数据失败:', error);
        }
    }

    // 加载工作流数据
    async loadWorkflowsData() {
        try {
            const workflowsData = await this.getSpreadsheetData(this.spreadsheetConfig.sheets.workflows, 'A:B');
            this.workflows = workflowsData.slice(1).map(row => ({
                name: row[0] || '',
                id: row[1] || ''
            })).filter(workflow => workflow.name && workflow.id);
            
            console.log('工作流数据加载成功:', this.workflows.length, '个工作流');
        } catch (error) {
            console.error('加载工作流数据失败:', error);
        }
    }

    // 加载模型数据
    async loadModelsData() {
        try {
            const modelsData = await this.getSpreadsheetData(this.spreadsheetConfig.sheets.models, 'A:B');
            this.models = modelsData.slice(1).map(row => ({
                name: row[0] || '',
                value: row[1] || ''
            })).filter(model => model.name && model.value);
            
            console.log('模型数据加载成功:', this.models.length, '个模型');
        } catch (error) {
            console.error('加载模型数据失败:', error);
        }
    }

    // 处理运行 - 调用Coze AI API
    async handleRun() {
        const agentSelect = document.getElementById('agentSelect');
        const modelSelect = document.getElementById('modelSelect');
        const workflowSelect = document.getElementById('workflowSelect'); // 添加工作流选择框
        const inputText = document.getElementById('inputText').value.trim();
        
        if (!agentSelect.value) {
            this.showNotification('请选择智能体', 'error');
            return;
        }

        if (!workflowSelect.value) { // 添加工作流选择验证
        this.showNotification('请选择工作流', 'error');
        return;
    }
        
        if (!inputText) {
            this.showNotification('请输入文本内容', 'error');
            return;
        }

        if (!this.cozeToken) {
            this.showNotification('API令牌未配置', 'error');
            return;
        }

        try {
            this.showLoading();
            
            const selectedPrompt = this.prompts.find(p => p.id == agentSelect.value);
            const selectedModel = this.models.find(m => m.value === modelSelect.value);
            
            const result = await this.callCozeAPI(
                selectedPrompt.content,
                inputText,
                selectedModel.value,
                workflowSelect.value // 传递选中的工作流ID
            );
            
            this.displayResult(result);
            
        } catch (error) {
            console.error('AI调用失败:', error);
            this.showNotification('AI处理失败，请重试', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 调用Coze AI API
    async callCozeAPI(sysInput, userInput, model, workflowId) {
        try {
            const response = await fetch(`${this.cozeConfig.baseUrl}/workflow/run`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.cozeToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    workflow_id: workflowId,
                    //原来的硬编码是 workflow_id: this.cozeConfig.workflowId,
                    parameters: {
                        model: model,
                        sys_input: sysInput,
                        user_input: userInput
                    }
                })
            });
            
            const data = await response.json();
            
            if (data.code === 0) {
                // 解析返回的JSON数据
                let outputData;
                try {
                    outputData = JSON.parse(data.data);
                } catch (e) {
                    outputData = { output: data.data };
                }
                
                return {
                    output: outputData.output || '处理完成',
                    tokens: data.token || 0,
                    cost: ((data.token || 0) / 1000 * 0.024).toFixed(4)
                };
            } else {
                throw new Error(`API调用失败: ${data.msg}`);
            }
        } catch (error) {
            console.error('Coze API调用失败:', error);
            throw error;
        }
    }

    // 新增提示词
    async addPrompt(name, content) {
        try {
            const response = await fetch(`${this.feishuConfig.baseUrl}/sheets/v2/spreadsheets/${this.spreadsheetConfig.spreadsheetToken}/values_append`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.feishuToken}`,
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify({
                    valueRange: {
                        range: `${this.spreadsheetConfig.sheets.prompts}!A1:D1`,
                        values: [[name, content, this.currentUser.username, '仅作者']]
                    }
                })
            });
            
            const data = await response.json();
            console.log('飞书API响应:', data); // 添加此行调试日志
            
            if (data.code === 0) {
                this.showNotification('添加成功！', 'success');
                await this.loadPromptsData(); // 重新加载数据
                this.renderPrompts();
                return true;
            } else {
                throw new Error(`添加失败: ${data.msg} (错误码: ${data.code})`);
            }
        } catch (error) {
            console.error('添加提示词失败:', error);
            this.showNotification('添加失败，请重试', 'error');
            return false;
        }
    }

    // 修改提示词
    async updatePrompt(prompt, newName, newContent) {
        try {
            // 更新名称
            await fetch(`${this.feishuConfig.baseUrl}/sheets/v2/spreadsheets/${this.spreadsheetConfig.spreadsheetToken}/values`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.feishuToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    valueRange: {
                        range: `${this.spreadsheetConfig.sheets.prompts}!A${prompt.rowIndex}:A${prompt.rowIndex}`,
                        values: [[newName]]
                    }
                })
            });
            
            // 更新内容
            await fetch(`${this.feishuConfig.baseUrl}/sheets/v2/spreadsheets/${this.spreadsheetConfig.spreadsheetToken}/values`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.feishuToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    valueRange: {
                        range: `${this.spreadsheetConfig.sheets.prompts}!B${prompt.rowIndex}:B${prompt.rowIndex}`,
                        values: [[newContent]]
                    }
                })
            });
            
            this.showNotification('修改成功！', 'success');
            await this.loadPromptsData(); // 重新加载数据
            this.renderPrompts();
            return true;
            
        } catch (error) {
            console.error('修改提示词失败:', error);
            this.showNotification('修改失败，请重试', 'error');
            return false;
        }
    }

    // 删除提示词
    async deletePrompt(prompt) {
        try {
            const response = await fetch(`${this.feishuConfig.baseUrl}/sheets/v2/spreadsheets/${this.spreadsheetConfig.spreadsheetToken}/dimension_range`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.feishuToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    dimension: {
                        sheetId: this.spreadsheetConfig.sheets.prompts,
                        majorDimension: 'ROWS',
                        startIndex: prompt.rowIndex, //- 1, // 转换为0索引
                        endIndex: prompt.rowIndex //- 1
                    }
                })
            });
            
            const data = await response.json();
            
            if (data.code === 0) {
                this.showNotification('删除成功！', 'success');
                await this.loadPromptsData(); // 重新加载数据
                this.renderPrompts();
                return true;
            } else {
                throw new Error(`删除失败: ${data.msg}`);
            }
        } catch (error) {
            console.error('删除提示词失败:', error);
            this.showNotification('删除失败，请重试', 'error');
            return false;
        }
    }

    // 保存到表格
    async saveToSheet() {
        const output = document.getElementById('outputText').textContent;
        if (!output || output.includes('等待输入内容')) {
            this.showNotification('没有内容可保存', 'error');
            return;
        }
        
        try {
            const saveUrl = document.getElementById('saveSheetUrl').value || this.spreadsheetConfig.sheets.results;
            
            // 从URL中提取spreadsheet token
            const urlMatch = saveUrl.match(/sheets\/([a-zA-Z0-9]+)(\?sheet=([a-zA-Z0-9]+))?/);
            if (!urlMatch || urlMatch.length < 2) {
                throw new Error('无效的表格URL格式');
            }
            const spreadsheetToken_write = urlMatch[1];
            const sheetId = urlMatch[3] || '340c75'; // 提取sheetId或使用默认值
            
            const response = await fetch(`${this.feishuConfig.baseUrl}/sheets/v2/spreadsheets/${spreadsheetToken_write}/values_append`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.feishuToken}`,
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify({
                    valueRange: {
                        range: `${sheetId}!A1:B1`, 
                        values: [[output, this.currentUser.username]]
                    }
                })
            });
            
            const data = await response.json();
            
            if (data.code === 0) {
                this.showNotification('已保存到在线表格！', 'success');
            } else {
                throw new Error(`保存失败: ${data.msg}`);
            }
            
        } catch (error) {
            console.error('保存到表格失败:', error);
            this.showNotification('保存失败，请联系管理员', 'error');
        }
    }

    // 处理提示词提交
    async handlePromptSubmit() {
        const name = document.getElementById('promptName').value.trim();
        const content = document.getElementById('promptContent').value.trim();
        const editId = document.getElementById('promptModal').dataset.editId;
        
        if (!name || !content) {
            this.showNotification('请填写完整信息', 'error');
            return;
        }

        if (editId) {
            // 编辑模式
            const prompt = this.prompts.find(p => p.id == editId);
            if (prompt) {
                const success = await this.updatePrompt(prompt, name, content);
                if (success) {
                    this.hidePromptModal();
                }
            }
        } else {
            // 新增模式
            const success = await this.addPrompt(name, content);
            if (success) {
                this.hidePromptModal();
            }
        }
    }

    // 删除提示词确认
    async confirmDeletePrompt(prompt) {
        if (prompt.author !== this.currentUser.username && this.currentUser.username !== 'admin') {
            this.showNotification('无权限操作，请联系系统管理员', 'error');
            return;
        }

        if (confirm('确认删除？此操作不可逆')) {
            await this.deletePrompt(prompt);
        }
    }

    // 填充模型选择框
    populateModelSelect() {
        const select = document.getElementById('modelSelect');
        select.innerHTML = '';
        
        this.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.name;
            select.appendChild(option);
        });
    }

    // 填充智能体选择框
    populateAgentSelect() {
        const select = document.getElementById('agentSelect');
        select.innerHTML = '<option value="">请选择智能体</option>';
        
        const visiblePrompts = this.prompts.filter(prompt => {
            return prompt.visibility === '全部' || 
                   prompt.author === this.currentUser.username ||
                   this.currentUser.username === 'admin';
        });

        visiblePrompts.forEach(prompt => {
            const option = document.createElement('option');
            option.value = prompt.id;
            option.textContent = prompt.name;
            option.dataset.content = prompt.content;
            select.appendChild(option);
        });
    }

    // 填充工作流选择框
    populateWorkflowSelect() {
        const select = document.getElementById('workflowSelect');
        select.innerHTML = '<option value="">请选择工作流</option>';
        
        this.workflows.forEach(workflow => {
            const option = document.createElement('option');
            option.value = workflow.id;
            option.textContent = `${workflow.name}（${workflow.id}）`;
            select.appendChild(option);
        });

        // 设置默认选中第一个工作流
        if (this.workflows.length > 0) {
            select.value = this.workflows[0].id;
        }
    }

    // 填充所有选择框
    populateSelects() {
        this.populateAgentSelect();
        this.populateWorkflowSelect();
        this.populateModelSelect();
    }

    // 显示主应用
    showMainApp() {
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        
        // 更新用户信息
        document.getElementById('currentUser').textContent = this.currentUser.username;
        document.getElementById('userAvatar').textContent = this.currentUser.username.charAt(0).toUpperCase();
    }

    // 更新令牌信息
    updateTokenInfo() {
        if (this.tokenExpiry) {
            const expiryDate = new Date(this.tokenExpiry);
            const today = new Date();
            const diffTime = expiryDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            document.getElementById('tokenExpiry').textContent = this.tokenExpiry;
            document.getElementById('tokenDays').textContent = Math.max(0, diffDays);
            
            // 在设置页面也更新
            if (this.cozeToken) {
                document.getElementById('accessToken').value = this.cozeToken;
            }
            document.getElementById('tokenExpiration').value = this.tokenExpiry;
        }
    }

    // 渲染提示词列表
    renderPrompts() {
        const container = document.getElementById('promptsList');
        container.innerHTML = '';

        const visiblePrompts = this.prompts.filter(prompt => {
            return prompt.visibility === '全部' || 
                   prompt.author === this.currentUser.username ||
                   this.currentUser.username === 'admin';
        });

        if (visiblePrompts.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-robot text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">暂无可用的智能体</p>
                    <p class="text-gray-400 text-sm mt-1">点击右上角按钮添加新的提示词</p>
                </div>
            `;
            return;
        }

        visiblePrompts.forEach(prompt => {
            const card = this.createPromptCard(prompt);
            container.appendChild(card);
        });
    }

    // 创建提示词卡片
    createPromptCard(prompt) {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer';
        
        const canEdit = prompt.author === this.currentUser.username || this.currentUser.username === 'admin';
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-lg font-semibold text-gray-800">${prompt.name}</h3>
                <div class="flex space-x-2">
                    ${canEdit ? `
                        <button class="edit-prompt text-blue-500 hover:text-blue-700 transition-colors" data-id="${prompt.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-prompt text-red-500 hover:text-red-700 transition-colors" data-id="${prompt.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <p class="text-gray-600 text-sm mb-4 line-clamp-3">${prompt.content}</p>
            <div class="flex justify-between items-center text-xs text-gray-500">
                <span><i class="fas fa-user mr-1"></i>${prompt.author}</span>
                <span><i class="fas fa-eye mr-1"></i>${prompt.visibility}</span>
            </div>
        `;

        // 绑定事件
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.edit-prompt') && !e.target.closest('.delete-prompt')) {
                this.selectPrompt(prompt);
            }
        });

        if (canEdit) {
            card.querySelector('.edit-prompt').addEventListener('click', (e) => {
                e.stopPropagation();
                this.editPrompt(prompt);
            });

            card.querySelector('.delete-prompt').addEventListener('click', (e) => {
                e.stopPropagation();
                this.confirmDeletePrompt(prompt);
            });
        }

        return card;
    }

    // 其他方法保持不变...
    bindEvents() {
        // 登录表单
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // 导航标签
        document.getElementById('promptsTab').addEventListener('click', () => this.switchTab('prompts'));
        document.getElementById('agentTab').addEventListener('click', () => this.switchTab('agent'));
        document.getElementById('settingsTab').addEventListener('click', () => this.switchTab('settings'));

        // 提示词页面
        document.getElementById('addPromptBtn').addEventListener('click', () => this.showPromptModal());
        document.getElementById('confirmModalBtn').addEventListener('click', () => this.handlePromptSubmit());
        document.getElementById('cancelModalBtn').addEventListener('click', () => this.hidePromptModal());

        // 智能体页面
        document.getElementById('runBtn').addEventListener('click', () => this.handleRun());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearInput());
        document.getElementById('saveLocalBtn').addEventListener('click', () => this.saveToLocal());
        document.getElementById('saveSheetBtn').addEventListener('click', () => this.saveToSheet());
        document.getElementById('copyBtn').addEventListener('click', () => this.copyOutput());

        // 设置页面
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());

        // 模态框外点击关闭
        document.getElementById('promptModal').addEventListener('click', (e) => {
            if (e.target.id === 'promptModal') {
                this.hidePromptModal();
            }
        });

        // 绑定退出登录事件
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

        // 添加主题切换事件
        document.getElementById('themeToggle')?.addEventListener('change', () => {
            this.toggleDarkMode();
        });
    }

    showLoginPage() {
        document.getElementById('loginPage').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    switchTab(tab) {
        // 更新导航按钮状态
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('bg-blue-100', 'text-blue-600', 'active');
            btn.classList.add('bg-gray-100', 'text-gray-600');
        });

        document.getElementById(tab + 'Tab').classList.remove('bg-gray-100', 'text-gray-600');
        document.getElementById(tab + 'Tab').classList.add('bg-blue-100', 'text-blue-600', 'active');

        // 隐藏所有页面
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.add('hidden');
        });

        // 显示当前页面
        document.getElementById(tab + 'Page').classList.remove('hidden');
        this.currentTab = tab;

        // 根据页面执行特定逻辑
        if (tab === 'prompts') {
            this.renderPrompts();
        } else if (tab === 'agent') {
            this.populateAgentSelect();
        } else if (tab === 'settings') {
            this.populateWorkflowSelect();
        }
    }

    selectPrompt(prompt) {
        this.switchTab('agent');
        document.getElementById('agentSelect').value = prompt.id;
        this.showNotification(`已选择智能体：${prompt.name}`, 'success');
    }

    showPromptModal(prompt = null) {
        const modal = document.getElementById('promptModal');
        const title = document.getElementById('modalTitle');
        const confirmBtn = document.getElementById('confirmModalBtn');
        
        if (prompt) {
            title.textContent = '编辑提示词';
            confirmBtn.textContent = '确认修改';
            document.getElementById('promptName').value = prompt.name;
            document.getElementById('promptContent').value = prompt.content;
            modal.dataset.editId = prompt.id;
        } else {
            title.textContent = '新增提示词';
            confirmBtn.textContent = '确认添加';
            document.getElementById('promptName').value = '';
            document.getElementById('promptContent').value = '';
            modal.dataset.editId = '';
        }
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    hidePromptModal() {
        document.getElementById('promptModal').classList.add('hidden');
        document.getElementById('promptModal').classList.remove('flex');
    }

    editPrompt(prompt) {
        this.showPromptModal(prompt);
    }

    displayResult(result) {
        const outputDiv = document.getElementById('outputText');
        const tokenInfo = document.getElementById('tokenInfo');
        
        outputDiv.innerHTML = `<div class="whitespace-pre-wrap">${result.output}</div>`;
        tokenInfo.innerHTML = `
            <i class="fas fa-coins mr-2"></i>
            本次输出消耗${result.tokens}个Token，大约是${result.cost}元
        `;
    }

    clearInput() {
        document.getElementById('inputText').value = '';
        document.getElementById('agentSelect').value = '';
        if (this.models.length > 0) {
            document.getElementById('modelSelect').value = this.models[0].value;
        }
    }

    saveToLocal() {
        const output = document.getElementById('outputText').textContent;
        if (!output || output.includes('等待输入内容')) {
            this.showNotification('没有内容可保存', 'error');
            return;
        }
        
        const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `改写结果_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('保存成功！', 'success');
    }

    copyOutput() {
        const output = document.getElementById('outputText').textContent;
        if (!output || output.includes('等待输入内容')) {
            this.showNotification('没有内容可复制', 'error');
            return;
        }
        
        navigator.clipboard.writeText(output).then(() => {
            this.showNotification('复制成功！', 'success');
        }).catch(() => {
            this.showNotification('复制失败', 'error');
        });
    }

    saveSettings() {
        const saveSheetUrl = document.getElementById('saveSheetUrl').value;
        localStorage.setItem('saveSheetUrl', saveSheetUrl);
        this.showNotification('设置保存成功！', 'success');
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
        document.getElementById('loadingOverlay').classList.add('flex');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
        document.getElementById('loadingOverlay').classList.remove('flex');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 animate-slide-up max-w-sm`;
        
        const colors = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            info: 'bg-blue-500 text-white',
            warning: 'bg-orange-500 text-white'
        };
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle',
            warning: 'fas fa-exclamation-triangle'
        };
        
        notification.className += ` ${colors[type] || colors.info}`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="${icons[type] || icons.info} mr-3"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new AIRewriteApp();
});