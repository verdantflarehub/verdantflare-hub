<script setup>
import AppIcon from "../components/AppIcon.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

defineProps({ organization: { type: Object, required: true }, internal: Boolean });

const experiences = [
  { title: "通用对话助手", meta: "多轮对话体验", time: "今天 14:26", status: "已完成" },
  { title: "图像生成应用", meta: "文生图体验", time: "今天 11:03", status: "已完成" },
  { title: "视频理解助手", meta: "视频内容问答", time: "今天 09:18", status: "运行中" },
];

const tasks = [
  { title: "文本生成请求", meta: "VF-Chat", time: "今天 14:12", status: "已完成" },
  { title: "图像生成请求", meta: "VF-Image", time: "今天 13:47", status: "已完成" },
  { title: "视频分析请求", meta: "VF-Video", time: "今天 12:21", status: "处理中" },
];
</script>

<template>
  <div class="page overview-page">
    <header class="overview-hero">
      <div>
        <h1>工作台</h1>
        <p>从模型与应用发现，进入在线体验或 API 调用。</p>
        <div class="welcome-actions">
          <button class="button primary" @click="navigate('/market')"><AppIcon name="market" :size="18" />浏览应用市场<AppIcon name="arrow" :size="16" /></button>
          <button class="button secondary" @click="navigate('/api/playground')"><AppIcon name="spark" :size="18" />打开 Playground</button>
        </div>
      </div>
      <div class="hero-landscape" aria-hidden="true">
        <i /><i /><i />
        <span>让优秀的模型与应用<br />创造更大的可能</span>
      </div>
    </header>

    <section class="resource-rail">
      <header><strong>我的资源与用量</strong><button @click="navigate('/api/usage')">查看用量详情<AppIcon name="arrow" :size="15" /></button></header>
      <div class="resource-items">
        <div><span class="resource-icon"><AppIcon name="models" :size="20" /></span><span><small>可用模型</small><strong>28</strong></span></div>
        <div><span class="resource-icon"><AppIcon name="market" :size="20" /></span><span><small>可用应用</small><strong>22</strong></span></div>
        <div><span class="resource-icon"><AppIcon name="key" :size="20" /></span><span><small>API 密钥</small><strong>6</strong></span></div>
        <div><span class="resource-icon"><AppIcon name="usage" :size="20" /></span><span><small>API 余额</small><strong>{{ organization.apiCredits.toLocaleString() }}</strong></span></div>
      </div>
    </section>

    <section class="dashboard-feature">
      <div class="feature-mark"><img src="/brand/verdantflare-logo.svg" alt="" /></div>
      <div class="feature-message"><small>精选应用</small><h2>影像内容理解助手</h2><p>基于多模态模型的影视内容分析与结构化处理，支持视频、图像与字幕的联合理解。</p><button class="button primary" @click="navigate('/market/apps/wan-video')">立即体验<AppIcon name="arrow" :size="16" /></button></div>
      <div class="feature-art" aria-hidden="true"><span /><i /><i /></div>
      <ul><li><AppIcon name="video" :size="16" />多模态内容理解</li><li><AppIcon name="spark" :size="16" />关键片段智能标注</li><li><AppIcon name="tasks" :size="16" />支持批量处理</li><li><AppIcon name="external" :size="16" />可通过 API 集成</li></ul>
    </section>

    <div class="overview-lists">
      <section>
        <div class="section-heading"><div><h2>最近体验</h2></div><button class="text-button" @click="navigate('/experience')">查看全部<AppIcon name="arrow" :size="14" /></button></div>
        <div class="dashboard-list">
          <button v-for="item in experiences" :key="item.title" @click="navigate('/experience')">
            <span class="list-emblem"><AppIcon name="experience" :size="17" /></span><span class="list-copy"><strong>{{ item.title }}</strong><small>{{ item.meta }}</small></span><time>{{ item.time }}</time><StatusBadge :label="item.status" />
          </button>
        </div>
      </section>
      <section>
        <div class="section-heading"><div><h2>最近 API 任务</h2></div><button class="text-button" @click="navigate('/api/tasks')">查看全部<AppIcon name="arrow" :size="14" /></button></div>
        <div class="dashboard-list">
          <button v-for="task in tasks" :key="task.title" @click="navigate('/api/tasks')">
            <span class="list-emblem"><AppIcon name="tasks" :size="17" /></span><span class="list-copy"><strong>{{ task.title }}</strong><small>{{ task.meta }}</small></span><time>{{ task.time }}</time><StatusBadge :label="task.status" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
