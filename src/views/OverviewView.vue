<script setup>
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

defineProps({ organization: { type: Object, required: true }, internal: Boolean });

const abilities = [
  { title: "应用市场", description: "浏览已授权应用、版本与在线体验入口", icon: "market", tone: "mint", href: "/market", action: "进入应用市场" },
  { title: "体验中心", description: "1 个 Session 运行中，本月已使用 142 点", icon: "experience", tone: "blue", href: "/experience", action: "继续体验" },
  { title: "模型市场", description: "浏览已授权模型、价格、能力与调用方式", icon: "models", tone: "coral", href: "/api/models", action: "进入模型市场" },
];

const tasks = [
  { title: "ComfyUI Studio 体验会话", meta: "exp_2F7A19 · 华东", time: "还剩 42 分钟", status: "运行中" },
  { title: "VerdantFlare SD2 视频任务", meta: "task_9D2A · 1080p", time: "已运行 3 分钟", status: "运行中" },
  { title: "API 月度预算", meta: "本月已使用 68%", time: "剩余 12,840 点", status: "正常" },
];
</script>

<template>
  <div class="page overview-page">
    <section class="welcome-band">
      <div>
        <span class="page-overline">CENTER OVERVIEW</span>
        <h1>下午好，准备开始创作了吗？</h1>
        <p>{{ organization.name }} 的应用、体验与 API 使用情况都在这里。</p>
      </div>
      <div class="welcome-actions">
        <button class="button secondary" @click="navigate('/api/keys')"><AppIcon name="key" :size="17" />创建 API Key</button>
        <button class="button primary" @click="navigate('/experience')"><AppIcon name="spark" :size="17" />开始体验</button>
      </div>
    </section>

    <section class="metric-grid">
      <MetricCard label="可用应用" value="22" detail="含 4 个 Preview" icon="market" tone="mint" />
      <MetricCard label="体验额度" :value="`${organization.experienceCredits} 点`" detail="本月已使用 142 点" icon="experience" tone="blue" />
      <MetricCard label="API 余额" :value="organization.apiCredits.toLocaleString()" detail="本月预算剩余 32%" icon="usage" tone="coral" />
      <MetricCard label="运行中任务" value="2" detail="无失败或异常" icon="tasks" tone="violet" />
    </section>

    <div class="overview-columns">
      <section>
        <div class="section-heading"><div><h2>可用能力</h2><p>根据当前组织的角色与权益动态显示。</p></div></div>
        <div class="ability-list">
          <button v-for="ability in abilities" :key="ability.title" class="ability-row" @click="navigate(ability.href)">
            <span class="ability-icon" :class="ability.tone"><AppIcon :name="ability.icon" :size="22" /></span>
            <span class="ability-copy"><strong>{{ ability.title }}</strong><small>{{ ability.description }}</small></span>
            <span class="ability-action">{{ ability.action }}<AppIcon name="arrow" :size="15" /></span>
          </button>
        </div>
      </section>

      <section class="activity-panel">
        <div class="section-heading"><div><h2>用量趋势</h2><p>过去 7 天 · API 与体验合计</p></div><button class="text-button" @click="navigate('/api/usage')">查看详情</button></div>
        <div class="usage-chart" aria-label="过去七天用量柱状图">
          <div class="chart-scale"><span>600</span><span>400</span><span>200</span><span>0</span></div>
          <div class="chart-bars">
            <div v-for="(height, index) in [36, 52, 43, 72, 58, 81, 68]" :key="index" class="bar-column">
              <i :style="{ height: `${height}%` }"><span /></i><small>{{ ['周五', '周六', '周日', '周一', '周二', '周三', '今天'][index] }}</small>
            </div>
          </div>
        </div>
        <div class="chart-legend"><span><i class="mint" />API 用量 1,846 点</span><span><i class="blue" />体验用量 142 点</span></div>
      </section>
    </div>

    <section class="recent-section">
      <div class="section-heading"><div><h2>正在进行</h2><p>Session、任务与额度状态。</p></div><button class="text-button" @click="navigate('/api/tasks')">全部任务</button></div>
      <div class="data-table recent-table">
        <div class="table-head"><span>事项</span><span>标识 / 区域</span><span>进度</span><span>状态</span></div>
        <div v-for="task in tasks" :key="task.title" class="table-row">
          <strong>{{ task.title }}</strong><span>{{ task.meta }}</span><span>{{ task.time }}</span><StatusBadge :label="task.status" />
        </div>
      </div>
    </section>
  </div>
</template>
