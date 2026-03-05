// ========== 元素合成实验室 - 核心游戏逻辑 ==========

class ElementGame {
    constructor() {
        // 游戏状态
        this.grid = new Array(CONFIG.GRID_SIZE * CONFIG.GRID_SIZE).fill(null);
        this.lastProductionTime = Date.now();
        this.productionPaused = false;
        this.unlockedElements = new Set([1]); // 氢默认解锁
        this.tools = { shovel: 3, swap: 2, copy: 1 };
        this.activeTool = null;
        this.swapFirstCell = null;
        this.totalMerges = 0;
        this.mergeCountByElement = {};
        this.producedCount = 0;
        this.highestElement = 1;

        // 任务状态
        this.dailyTasks = [];
        this.achievementProgress = {};
        this.claimedAchievements = new Set();
        this.claimedDailyTasks = new Set();
        this.lastDailyReset = null;

        // 拖拽状态
        this.dragging = null;
        this.dragSource = null; // { type: 'grid', index: number }
        this.dragElement = null;

        // UI缓存
        this.gridCells = [];

        this.init();
    }

    // ========== 初始化 ==========
    init() {
        this.loadGame();
        this.buildGrid();
        this.initDailyTasks();
        this.bindEvents();
        this.initStarterElements();
        this.startProductionLoop();
        this.updateAllUI();
    }

    // 新游戏初始方块 - 给玩家2个H和1个He作为起步
    initStarterElements() {
        // 只在全空网格时放置初始元素（真正的新游戏）
        const hasAny = this.grid.some(c => c !== null);
        if (hasAny) return;
        this.grid[14] = 1; // H
        this.grid[15] = 1; // H
        this.grid[20] = 1; // H
        this.grid[21] = 2; // He
        this.unlockedElements.add(1);
        this.unlockedElements.add(2);
        this.renderGrid();
    }

    // ========== 构建网格 ==========
    buildGrid() {
        const gridEl = document.getElementById('grid');
        gridEl.innerHTML = '';
        this.gridCells = [];
        for (let i = 0; i < CONFIG.GRID_SIZE * CONFIG.GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.index = i;
            gridEl.appendChild(cell);
            this.gridCells.push(cell);
        }
        this.renderGrid();
    }

    // ========== 渲染网格 ==========
    renderGrid() {
        for (let i = 0; i < this.grid.length; i++) {
            const cell = this.gridCells[i];
            const el = this.grid[i];
            // 清除旧内容（但保留高亮类）
            const existing = cell.querySelector('.element-block');
            if (existing) existing.remove();

            if (el !== null) {
                cell.classList.add('occupied');
                cell.appendChild(this.createElementBlock(el));
            } else {
                cell.classList.remove('occupied');
            }
        }
        this.updateEmptySlots();
    }

    // ========== 创建元素方块DOM ==========
    createElementBlock(atomicNumber) {
        const data = ELEMENTS[atomicNumber];
        if (!data) return document.createElement('div');
        const block = document.createElement('div');
        block.className = `element-block element-${atomicNumber}`;
        block.innerHTML = `
            <span class="element-symbol">${data.symbol}</span>
            <span class="element-number">${atomicNumber}</span>
        `;
        return block;
    }

    // ========== 生产逻辑 ==========
    startProductionLoop() {
        this.productionInterval = setInterval(() => this.updateProduction(), 250);
    }

    getEmptyCells() {
        const empty = [];
        for (let i = 0; i < this.grid.length; i++) {
            if (this.grid[i] === null) empty.push(i);
        }
        return empty;
    }

    updateProduction() {
        const emptyCells = this.getEmptyCells();
        const bar = document.getElementById('prod-timer-bar');
        const statusEl = document.getElementById('prod-status');

        // 网格满时暂停生产
        if (emptyCells.length === 0) {
            this.productionPaused = true;
            bar.style.width = '0%';
            statusEl.textContent = '已暂停';
            statusEl.style.color = 'var(--danger)';
            return;
        }

        this.productionPaused = false;
        statusEl.textContent = '生产中';
        statusEl.style.color = 'var(--accent)';

        const now = Date.now();
        const elapsed = now - this.lastProductionTime;
        const progress = Math.min(elapsed / CONFIG.PRODUCTION_INTERVAL, 1);
        bar.style.width = `${progress * 100}%`;

        if (elapsed >= CONFIG.PRODUCTION_INTERVAL) {
            this.produceElement();
            this.lastProductionTime = now;
        }
    }

    produceElement() {
        const emptyCells = this.getEmptyCells();
        if (emptyCells.length === 0) return;

        const element = Math.random() < CONFIG.H_PROBABILITY ? 1 : 2;
        // 随机选一个空位放入
        const targetIdx = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        this.grid[targetIdx] = element;
        this.producedCount++;
        if (element === 2) this.unlockedElements.add(2);

        // 播放入场动画
        this.renderGrid();
        const block = this.gridCells[targetIdx].querySelector('.element-block');
        if (block) block.classList.add('element-pop-in');

        this.updateTaskProgress('produce', 0, 1);
        this.updateAllUI();
        this.saveGame();
    }

    speedUpProduction() {
        const emptyCells = this.getEmptyCells();
        if (emptyCells.length === 0) {
            this.showToast('合成区已满，请先合成腾出空间！');
            return;
        }
        this.produceElement();
        this.lastProductionTime = Date.now();
        this.showToast('加速生产成功！');
    }

    // ========== 拖拽系统 ==========
    bindEvents() {
        const app = document.getElementById('app');

        // 触摸/鼠标事件（统一处理）
        app.addEventListener('mousedown', (e) => this.onDragStart(e));
        app.addEventListener('mousemove', (e) => this.onDragMove(e));
        app.addEventListener('mouseup', (e) => this.onDragEnd(e));
        app.addEventListener('touchstart', (e) => this.onDragStart(e), { passive: false });
        app.addEventListener('touchmove', (e) => this.onDragMove(e), { passive: false });
        app.addEventListener('touchend', (e) => this.onDragEnd(e));

        // 加速按钮
        document.getElementById('speed-btn').addEventListener('click', () => this.speedUpProduction());

        // 道具按钮
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleTool(btn.dataset.tool);
            });
        });

        // 底部菜单
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', () => this.showScreen(btn.dataset.page));
        });

        // 返回按钮
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => this.showScreen('game'));
        });

        // 任务标签页
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTaskTab(btn.dataset.tab));
        });

        // 弹窗关闭
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });
        document.querySelectorAll('.modal-overlay').forEach(el => {
            el.addEventListener('click', () => this.closeAllModals());
        });

        // 重置游戏
        document.getElementById('reset-btn').addEventListener('click', () => {
            if (confirm('确定要重置游戏吗？所有进度将丢失！')) {
                this.resetGame();
            }
        });
    }

    getEventPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (e.changedTouches && e.changedTouches.length > 0) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    onDragStart(e) {
        // 检查是否有活跃道具
        if (this.activeTool) {
            this.handleToolClick(e);
            return;
        }

        const pos = this.getEventPos(e);
        const target = document.elementFromPoint(pos.x, pos.y);
        if (!target) return;

        // 从网格拖拽
        const cell = target.closest('.grid-cell');
        if (cell) {
            const index = parseInt(cell.dataset.index);
            if (this.grid[index] !== null) {
                e.preventDefault();
                this.startDrag(this.grid[index], { type: 'grid', index }, pos);
                // 暂时隐藏原位置方块
                cell.querySelector('.element-block')?.classList.add('hidden');
                return;
            }
        }
    }

    startDrag(elementNum, source, pos) {
        this.dragging = elementNum;
        this.dragSource = source;

        // 创建拖拽元素
        const data = ELEMENTS[elementNum];
        this.dragElement = document.createElement('div');
        this.dragElement.className = `element-dragging element-${elementNum}`;
        this.dragElement.innerHTML = `
            <span class="element-symbol">${data.symbol}</span>
            <span class="element-number">${elementNum}</span>
        `;
        this.dragElement.style.left = pos.x + 'px';
        this.dragElement.style.top = pos.y + 'px';
        document.body.appendChild(this.dragElement);
    }

    onDragMove(e) {
        if (!this.dragging) return;
        e.preventDefault();
        const pos = this.getEventPos(e);
        this.dragElement.style.left = pos.x + 'px';
        this.dragElement.style.top = pos.y + 'px';

        // 高亮目标格子
        this.clearHighlights();
        const cell = this.getCellAtPos(pos);
        if (cell !== null) {
            const idx = parseInt(cell.dataset.index);
            const isSelf = this.dragSource?.type === 'grid' && this.dragSource.index === idx;
            if (this.grid[idx] === null) {
                cell.classList.add('highlight');
            } else if (this.grid[idx] === this.dragging && !isSelf) {
                cell.classList.add('highlight-merge');
            }
        }
    }

    onDragEnd(e) {
        if (!this.dragging) return;
        const pos = this.getEventPos(e);

        // 清除拖拽元素
        if (this.dragElement) {
            this.dragElement.remove();
            this.dragElement = null;
        }
        this.clearHighlights();

        const targetCell = this.getCellAtPos(pos);
        let placed = false;

        if (targetCell !== null) {
            const targetIdx = parseInt(targetCell.dataset.index);

            if (this.grid[targetIdx] === null) {
                // 放置到空格子
                this.placeElement(targetIdx, this.dragging);
                this.removeFromSource();
                placed = true;
            } else if (this.grid[targetIdx] === this.dragging) {
                // 合成检查 - 不能和自己合成
                const isSelf = this.dragSource?.type === 'grid' && this.dragSource.index === targetIdx;
                if (isSelf) {
                    // 拖回原位
                } else if (this.dragging + 1 > CONFIG.MAX_ELEMENT) {
                    // 已达到最高等级
                    this.showToast('已达到最高元素等级！');
                } else {
                    // 执行合成
                    this.mergeElements(targetIdx);
                    this.removeFromSource();
                    placed = true;
                }
            }
        }

        if (!placed) {
            // 恢复原位
            this.restoreSource();
        }

        this.dragging = null;
        this.dragSource = null;
        this.renderGrid();
        this.saveGame();
    }

    getCellAtPos(pos) {
        // Temporarily hide drag element so elementFromPoint hits the cell beneath
        if (this.dragElement) this.dragElement.style.display = 'none';
        const el = document.elementFromPoint(pos.x, pos.y);
        if (this.dragElement) this.dragElement.style.display = '';
        if (!el) return null;
        const cell = el.closest('.grid-cell');
        return cell;
    }

    placeElement(index, element) {
        this.grid[index] = element;
    }

    removeFromSource() {
        if (!this.dragSource) return;
        if (this.dragSource.type === 'grid') {
            this.grid[this.dragSource.index] = null;
        }
    }

    restoreSource() {
        // 源元素恢复可见
        if (this.dragSource?.type === 'grid') {
            const cell = this.gridCells[this.dragSource.index];
            const block = cell.querySelector('.element-block');
            if (block) block.classList.remove('hidden');
        }
    }

    clearHighlights() {
        this.gridCells.forEach(cell => {
            cell.classList.remove('highlight', 'highlight-merge');
        });
    }

    // ========== 合成逻辑 ==========
    mergeElements(targetIdx) {
        const currentElement = this.grid[targetIdx];
        const newElement = currentElement + 1;

        if (newElement > CONFIG.MAX_ELEMENT) {
            this.showToast('已达到最高元素等级！');
            return;
        }

        // 执行合成
        this.grid[targetIdx] = newElement;
        this.totalMerges++;
        this.mergeCountByElement[newElement] = (this.mergeCountByElement[newElement] || 0) + 1;

        // 解锁元素
        const isNew = !this.unlockedElements.has(newElement);
        this.unlockedElements.add(newElement);

        // 更新最高元素
        if (newElement > this.highestElement) {
            this.highestElement = newElement;
        }

        // 播放特效
        this.playMergeEffect(targetIdx, newElement);

        if (isNew) {
            const data = ELEMENTS[newElement];
            this.showToast(`发现新元素：${data.name}（${data.symbol}）！`);
        }

        // 更新任务进度
        this.updateTaskProgress('merge', newElement, 1);
        this.updateTaskProgress('total_merge', 0, 1);
        this.updateTaskProgress('first_merge', newElement, 1);
        this.updateTaskProgress('collect', 0, 0);

        this.updateAllUI();
    }

    playMergeEffect(cellIndex, newElement) {
        const cell = this.gridCells[cellIndex];
        const rect = cell.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const layer = document.getElementById('effects-layer');

        // 闪光
        const flash = document.createElement('div');
        flash.className = 'merge-effect';
        flash.style.left = cx + 'px';
        flash.style.top = cy + 'px';
        layer.appendChild(flash);
        setTimeout(() => flash.remove(), 500);

        // 粒子
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const dist = 30 + Math.random() * 20;
            const spark = document.createElement('div');
            spark.className = 'sparkle';
            spark.style.left = cx + 'px';
            spark.style.top = cy + 'px';
            spark.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            spark.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
            layer.appendChild(spark);
            setTimeout(() => spark.remove(), 600);
        }

        // 文字提示
        const data = ELEMENTS[newElement];
        const text = document.createElement('div');
        text.className = 'level-up-text';
        text.textContent = `${data.symbol}!`;
        text.style.left = cx + 'px';
        text.style.top = cy + 'px';
        layer.appendChild(text);
        setTimeout(() => text.remove(), 1000);
    }

    // ========== 道具系统 ==========
    toggleTool(toolName) {
        if (this.activeTool === toolName) {
            this.activeTool = null;
            this.swapFirstCell = null;
            this.updateToolButtons();
            return;
        }

        if (this.tools[toolName] <= 0) {
            this.showToast('道具不足！');
            return;
        }

        this.activeTool = toolName;
        this.swapFirstCell = null;
        this.updateToolButtons();

        const hints = {
            shovel: '点击要移除的方块',
            swap: '点击第一个要交换的方块',
            copy: '点击要复制的方块',
        };
        this.showToast(hints[toolName]);
    }

    updateToolButtons() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.activeTool);
        });
    }

    handleToolClick(e) {
        const pos = this.getEventPos(e);
        const target = document.elementFromPoint(pos.x, pos.y);
        if (!target) return;

        const cell = target.closest('.grid-cell');
        if (!cell) return;

        const index = parseInt(cell.dataset.index);

        switch (this.activeTool) {
            case 'shovel': this.useShovel(index); break;
            case 'swap': this.useSwap(index); break;
            case 'copy': this.useCopy(index); break;
        }
    }

    useShovel(index) {
        if (this.grid[index] === null) {
            this.showToast('该位置没有方块！');
            return;
        }
        this.grid[index] = null;
        this.tools.shovel--;
        this.activeTool = null;
        this.updateToolButtons();
        this.renderGrid();
        this.updateToolCounts();
        this.showToast('方块已移除！');
        this.saveGame();
    }

    useSwap(index) {
        if (this.grid[index] === null) {
            this.showToast('该位置没有方块！');
            return;
        }

        if (this.swapFirstCell === null) {
            this.swapFirstCell = index;
            this.gridCells[index].classList.add('highlight');
            this.showToast('点击第二个要交换的方块');
        } else {
            if (index === this.swapFirstCell) {
                this.gridCells[index].classList.remove('highlight');
                this.swapFirstCell = null;
                return;
            }
            // 交换
            const temp = this.grid[this.swapFirstCell];
            this.grid[this.swapFirstCell] = this.grid[index];
            this.grid[index] = temp;
            this.tools.swap--;
            this.clearHighlights();
            this.activeTool = null;
            this.swapFirstCell = null;
            this.updateToolButtons();
            this.renderGrid();
            this.updateToolCounts();
            this.showToast('交换成功！');
            this.saveGame();
        }
    }

    useCopy(index) {
        if (this.grid[index] === null) {
            this.showToast('该位置没有方块！');
            return;
        }

        const element = this.grid[index];

        // 不可复制最高级元素
        if (element === this.highestElement && element > 2) {
            this.showToast('不能复制最高级元素！');
            return;
        }

        // 找到相邻空格放置
        const emptyNeighbor = this.findEmptyNeighbor(index);
        if (emptyNeighbor === -1) {
            // 找任意空格
            const emptyCell = this.grid.indexOf(null);
            if (emptyCell === -1) {
                this.showToast('合成区已满，无法复制！');
                return;
            }
            this.grid[emptyCell] = element;
        } else {
            this.grid[emptyNeighbor] = element;
        }

        this.tools.copy--;
        this.activeTool = null;
        this.updateToolButtons();
        this.renderGrid();
        this.updateToolCounts();
        this.showToast('复制成功！');
        this.saveGame();
    }

    findEmptyNeighbor(index) {
        const row = Math.floor(index / CONFIG.GRID_SIZE);
        const col = index % CONFIG.GRID_SIZE;
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < CONFIG.GRID_SIZE && nc >= 0 && nc < CONFIG.GRID_SIZE) {
                const ni = nr * CONFIG.GRID_SIZE + nc;
                if (this.grid[ni] === null) return ni;
            }
        }
        return -1;
    }

    // ========== 任务系统 ==========
    initDailyTasks() {
        const today = new Date().toDateString();
        if (this.lastDailyReset !== today) {
            // 重置每日任务 - 随机选3个
            this.dailyTasks = this.shuffleArray([...DAILY_TASKS_POOL]).slice(0, 3).map(t => ({
                ...t,
                progress: 0,
                claimed: false,
            }));
            this.claimedDailyTasks = new Set();
            this.lastDailyReset = today;
            this.saveGame();
        }
    }

    updateTaskProgress(type, element, amount) {
        // 每日任务
        this.dailyTasks.forEach(task => {
            if (task.claimed) return;
            if (type === 'merge' && task.type === 'merge' && task.element === element) {
                task.progress = Math.min(task.progress + amount, task.target);
            }
            if (type === 'produce' && task.type === 'produce') {
                task.progress = Math.min(task.progress + amount, task.target);
            }
            if (type === 'collect' && task.type === 'collect') {
                task.progress = this.unlockedElements.size;
            }
        });

        // 成就
        ACHIEVEMENTS.forEach(ach => {
            if (this.claimedAchievements.has(ach.id)) return;
            let progress = this.achievementProgress[ach.id] || 0;

            if (type === 'total_merge' && ach.type === 'total_merge') {
                progress = this.totalMerges;
            }
            if (type === 'collect' && ach.type === 'collect') {
                progress = this.unlockedElements.size;
            }
            if (type === 'first_merge' && ach.type === 'first_merge' && ach.element === element) {
                progress = 1;
            }
            if (type === 'merge' && ach.type === 'total_merge') {
                progress = this.totalMerges;
            }

            this.achievementProgress[ach.id] = progress;
        });

        this.renderTasks();
    }

    claimDailyTask(taskId) {
        const task = this.dailyTasks.find(t => t.id === taskId);
        if (!task || task.claimed || task.progress < task.target) return;

        task.claimed = true;
        this.claimedDailyTasks.add(taskId);
        this.grantReward(task.reward);
        this.showToast(`领取奖励：${task.rewardText}`);
        this.renderTasks();
        this.updateToolCounts();
        this.saveGame();
    }

    claimAchievement(achId) {
        const ach = ACHIEVEMENTS.find(a => a.id === achId);
        if (!ach || this.claimedAchievements.has(achId)) return;

        const progress = this.achievementProgress[achId] || 0;
        if (progress < ach.target) return;

        this.claimedAchievements.add(achId);
        this.grantReward(ach.reward);
        this.showToast(`达成成就：${ach.title}！奖励：${ach.rewardText}`);
        this.renderTasks();
        this.updateToolCounts();
        this.saveGame();
    }

    grantReward(reward) {
        if (this.tools[reward.type] !== undefined) {
            this.tools[reward.type] += reward.amount;
        }
    }

    // ========== 图鉴 ==========
    renderEncyclopedia() {
        const container = document.getElementById('encyclopedia-grid');
        container.innerHTML = '';

        for (let i = 1; i <= CONFIG.MAX_ELEMENT; i++) {
            const data = ELEMENTS[i];
            const unlocked = this.unlockedElements.has(i);
            const card = document.createElement('div');
            card.className = `enc-card ${unlocked ? 'unlocked' : 'locked'}`;

            card.innerHTML = `
                <div class="enc-icon element-${i}" style="${unlocked ? '' : 'background: var(--bg-card-light) !important;'}">
                    ${unlocked ? data.symbol : '?'}
                </div>
                <div class="enc-name">${unlocked ? data.name : '???'}</div>
                <div class="enc-number">#${i}</div>
            `;

            if (unlocked) {
                card.addEventListener('click', () => this.showElementDetail(i));
            } else {
                card.addEventListener('click', () => {
                    const prevEl = ELEMENTS[i - 1];
                    this.showToast(`合成路径：两个${prevEl.name}(${prevEl.symbol}) → ${data.name}(${data.symbol})`);
                });
            }

            container.appendChild(card);
        }

        document.getElementById('enc-progress').textContent =
            `${this.unlockedElements.size}/${CONFIG.MAX_ELEMENT}`;
    }

    showElementDetail(num) {
        const data = ELEMENTS[num];
        const modal = document.getElementById('element-detail-modal');

        const icon = document.getElementById('detail-element-icon');
        icon.className = `detail-icon element-${num}`;
        icon.textContent = data.symbol;

        document.getElementById('detail-element-name').textContent =
            `${data.name} (${data.nameEn})`;

        document.getElementById('detail-element-info').innerHTML = `
            <p><strong>原子序数：</strong>${data.number}</p>
            <p><strong>元素符号：</strong>${data.symbol}</p>
            <p><strong>发现年份：</strong>${data.year}</p>
            <p><strong>简介：</strong>${data.desc}</p>
            <p><strong>用途：</strong>${data.use}</p>
        `;

        modal.classList.remove('hidden');
    }

    // ========== 任务渲染 ==========
    renderTasks() {
        // 每日任务
        const dailyContainer = document.getElementById('daily-tasks');
        dailyContainer.innerHTML = '';
        this.dailyTasks.forEach(task => {
            const progressPct = Math.min(task.progress / task.target * 100, 100);
            const canClaim = task.progress >= task.target && !task.claimed;

            const card = document.createElement('div');
            card.className = 'task-card';
            card.innerHTML = `
                <div class="task-title">${task.title}</div>
                <div class="task-desc">${task.desc}</div>
                <div class="task-progress-bar">
                    <div class="task-progress-fill" style="width:${progressPct}%"></div>
                </div>
                <div class="task-footer">
                    <span class="task-reward">${task.rewardText}</span>
                    <span>${task.progress}/${task.target}</span>
                    ${task.claimed
                        ? '<span class="task-claimed">已领取</span>'
                        : `<button class="task-claim-btn" ${canClaim ? '' : 'disabled'}
                            data-task-id="${task.id}" data-task-type="daily">
                            ${canClaim ? '领取' : '进行中'}
                          </button>`
                    }
                </div>
            `;
            dailyContainer.appendChild(card);
        });

        // 成就
        const achContainer = document.getElementById('achievement-tasks');
        achContainer.innerHTML = '';
        ACHIEVEMENTS.forEach(ach => {
            const progress = this.achievementProgress[ach.id] || 0;
            const claimed = this.claimedAchievements.has(ach.id);
            const progressPct = Math.min(progress / ach.target * 100, 100);
            const canClaim = progress >= ach.target && !claimed;

            const card = document.createElement('div');
            card.className = 'task-card';
            card.innerHTML = `
                <div class="task-title">${ach.title}</div>
                <div class="task-desc">${ach.desc}</div>
                <div class="task-progress-bar">
                    <div class="task-progress-fill" style="width:${progressPct}%"></div>
                </div>
                <div class="task-footer">
                    <span class="task-reward">${ach.rewardText}</span>
                    <span>${Math.min(progress, ach.target)}/${ach.target}</span>
                    ${claimed
                        ? '<span class="task-claimed">已达成</span>'
                        : `<button class="task-claim-btn" ${canClaim ? '' : 'disabled'}
                            data-task-id="${ach.id}" data-task-type="achievement">
                            ${canClaim ? '领取' : '进行中'}
                          </button>`
                    }
                </div>
            `;
            achContainer.appendChild(card);
        });

        // 绑定领取按钮
        document.querySelectorAll('.task-claim-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.taskId;
                const type = btn.dataset.taskType;
                if (type === 'daily') this.claimDailyTask(id);
                else this.claimAchievement(id);
            });
        });
    }

    // ========== 商城 ==========
    renderShop() {
        const container = document.getElementById('shop-list');
        container.innerHTML = '';
        SHOP_ITEMS.forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            card.innerHTML = `
                <div class="shop-icon">${item.icon}</div>
                <div class="shop-info">
                    <div class="shop-name">${item.name}</div>
                    <div class="shop-desc">${item.desc}</div>
                </div>
                <button class="shop-buy-btn" data-shop-id="${item.id}">${item.cost}</button>
            `;
            container.appendChild(card);
        });

        document.querySelectorAll('.shop-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = SHOP_ITEMS.find(s => s.id === btn.dataset.shopId);
                if (item) {
                    this.tools[item.tool] += item.amount;
                    this.updateToolCounts();
                    this.showToast(`获得 ${item.name} x${item.amount}！`);
                    this.saveGame();
                }
            });
        });
    }

    // ========== 界面切换 ==========
    showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        if (name === 'game') {
            document.getElementById('game-screen').classList.add('active');
        } else if (name === 'encyclopedia') {
            this.renderEncyclopedia();
            document.getElementById('encyclopedia-screen').classList.add('active');
        } else if (name === 'tasks') {
            this.renderTasks();
            document.getElementById('tasks-screen').classList.add('active');
        } else if (name === 'shop') {
            this.renderShop();
            document.getElementById('shop-screen').classList.add('active');
        } else if (name === 'settings') {
            document.getElementById('settings-screen').classList.add('active');
        }
    }

    switchTaskTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        document.getElementById('daily-tasks').classList.toggle('active', tab === 'daily');
        document.getElementById('achievement-tasks').classList.toggle('active', tab === 'achievement');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }

    // ========== UI更新 ==========
    updateAllUI() {
        this.updateEmptySlots();
        this.updateCollectProgress();
        this.updateToolCounts();
    }

    updateEmptySlots() {
        const total = CONFIG.GRID_SIZE * CONFIG.GRID_SIZE;
        const empty = this.grid.filter(c => c === null).length;
        document.getElementById('empty-slots').textContent = empty;

        // 网格满提示
        const container = document.getElementById('grid-container');
        const existing = container.querySelector('.grid-full-warning');
        if (empty === 0 && !existing) {
            const warning = document.createElement('div');
            warning.className = 'grid-full-warning';
            warning.textContent = '合成区已满！请合成腾出空间';
            container.appendChild(warning);
        } else if (empty > 0 && existing) {
            existing.remove();
        }
    }

    updateCollectProgress() {
        document.getElementById('collect-progress').textContent = this.unlockedElements.size;
    }

    updateToolCounts() {
        document.getElementById('shovel-count').textContent = this.tools.shovel;
        document.getElementById('swap-count').textContent = this.tools.swap;
        document.getElementById('copy-count').textContent = this.tools.copy;
    }

    showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2000);
    }

    // ========== 存档系统 ==========
    saveGame() {
        const save = {
            grid: this.grid,
            unlockedElements: Array.from(this.unlockedElements),
            tools: this.tools,
            totalMerges: this.totalMerges,
            mergeCountByElement: this.mergeCountByElement,
            producedCount: this.producedCount,
            highestElement: this.highestElement,
            dailyTasks: this.dailyTasks,
            achievementProgress: this.achievementProgress,
            claimedAchievements: Array.from(this.claimedAchievements),
            claimedDailyTasks: Array.from(this.claimedDailyTasks),
            lastDailyReset: this.lastDailyReset,
        };
        try {
            localStorage.setItem('elementGame', JSON.stringify(save));
        } catch (e) {
            // localStorage不可用时静默失败
        }
    }

    loadGame() {
        try {
            const raw = localStorage.getItem('elementGame');
            if (!raw) return;
            const save = JSON.parse(raw);

            if (save.grid) this.grid = save.grid;
            if (save.unlockedElements) this.unlockedElements = new Set(save.unlockedElements);
            if (save.tools) this.tools = save.tools;
            if (save.totalMerges) this.totalMerges = save.totalMerges;
            if (save.mergeCountByElement) this.mergeCountByElement = save.mergeCountByElement;
            if (save.producedCount) this.producedCount = save.producedCount;
            if (save.highestElement) this.highestElement = save.highestElement;
            if (save.dailyTasks) this.dailyTasks = save.dailyTasks;
            if (save.achievementProgress) this.achievementProgress = save.achievementProgress;
            if (save.claimedAchievements) this.claimedAchievements = new Set(save.claimedAchievements);
            if (save.claimedDailyTasks) this.claimedDailyTasks = new Set(save.claimedDailyTasks);
            if (save.lastDailyReset) this.lastDailyReset = save.lastDailyReset;
        } catch (e) {
            // 加载失败使用默认值
        }
    }

    resetGame() {
        localStorage.removeItem('elementGame');
        location.reload();
    }

    // ========== 工具方法 ==========
    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

// ========== 启动游戏 ==========
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ElementGame();
});
