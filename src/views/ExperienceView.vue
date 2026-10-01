<script setup>
import { computed, onMounted, ref } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { experienceSessions as seedSessions } from "../data/mock";
import { navigate } from "../router";

const props = defineProps({ organization: Object, query: { type: String, default: "" } });
const emit = defineEmits(["toast"]);
const requestedAppId = new URLSearchParams(props.query).get("app");
const selectedAppId = ref(requestedAppId || sessionStorage.getItem("vf_selected_experience_app") || "");
const apps = ref([]);
const appsLoading = ref(true);
const appsError = ref("");
const region = ref("cn-east-1");
const creating = ref(false);
const sessions = ref(structuredClone(seedSessions));
const showCreate = ref(false);

const selectedApp = computed(() => apps.value.find((app) => app.id === selectedAppId.value) || apps.value[0]);
const activeSessions = computed(() => sessions.value.filter((session) => session.status === "运行中"));

const createSession = async () => {
  if (!selectedApp.value) return;
  creating.value = true;
  try {
    const created = await controlApi.createExperienceSession({ appId: selectedApp.value.id, region: region.value });
    sessions.value.unshift({ id: created.id, app: selectedApp.value.name, region: region.value === "cn-east-1" ? "华东 · 上海" : "华北 · 北京", startedAt: "刚刚", remaining: "60 分钟", status: "运行中", usage: "0 点" });
    props.organization.experienceCredits -= 20;
    showCreate.value = false;
    emit("toast", `${selectedApp.value.name} Session 已创建`);
  } finally {
    creating.value = false;
  }
};

const closeSession = async (session) => {
  await controlApi.closeExperienceSession(session.id);
  session.status = "已结束";
  session.remaining = "用户关闭";
  emit("toast", "Session 已关闭，资源进入清理队列");
};

const loadApps = async () => {
  appsLoading.value = true;
  appsError.value = "";
  try {
    apps.value = (await controlApi.listApps()) || [];
    if (!apps.value.some((app) => app.id === selectedAppId.value)) {
      selectedAppId.value = apps.value[0]?.id || "";
    }
  } catch (cause) {
    appsError.value = cause instanceof Error ? cause.message : "应用权益加载失败";
  } finally {
    appsLoading.value = false;
  }
};

onMounted(loadApps);
</script>

<template>
  <div class="page experience-page">
    <header class="page-header">
      <div><span class="page-overline">EXPERIENCE CENTER</span><h1>在线体验</h1><p>在受限资源和自动清理策略下快速验证应用能力。</p></div>
      <button class="button primary" :disabled="appsLoading || apps.length === 0" @click="showCreate = true"><AppIcon name="plus" :size="17" />{{ appsLoading ? '正在加载应用…' : '新建体验 Session' }}</button>
    </header>

    <section class="metric-grid compact">
      <MetricCard label="可用额度" :value="`${organization.experienceCredits} 点`" detail="本月有效" icon="experience" tone="mint" />
      <MetricCard label="运行中 Session" :value="String(activeSessions.length)" detail="并发上限 2 个" icon="playground" tone="blue" />
      <MetricCard label="本月体验" value="9 次" detail="平均 26 分钟" icon="usage" tone="violet" />
    </section>

    <section v-if="appsError" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>应用权益加载失败</strong><p>{{ appsError }}</p></div><button class="button secondary" @click="loadApps">重新加载</button></section>

    <section v-if="activeSessions.length" class="live-session-card">
      <div class="live-session-mark"><span /><AppIcon name="nodes" :size="26" /></div>
      <div class="live-session-main"><span class="live-label">LIVE SESSION</span><h2>{{ activeSessions[0].app }}</h2><p>{{ activeSessions[0].id }} · {{ activeSessions[0].region }} · {{ activeSessions[0].startedAt }} 启动</p></div>
      <div class="session-clock"><span>剩余时间</span><strong>00:42:18</strong><small>到期后自动释放资源</small></div>
      <div class="session-actions"><button class="button primary" @click="$emit('toast', '正在打开体验工作区…')">打开工作区<AppIcon name="external" :size="15" /></button><button class="button danger" @click="closeSession(activeSessions[0])">关闭</button></div>
    </section>

    <section>
      <div class="section-heading"><div><h2>Session 记录</h2><p>体验素材与结果不进入 Studio 项目资产。</p></div><button class="text-button">查看清理策略</button></div>
      <div class="data-table session-table">
        <div class="table-head"><span>Session / 应用</span><span>区域</span><span>启动时间</span><span>时长 / 清理</span><span>用量</span><span>状态</span><span /></div>
        <div v-for="session in sessions" :key="session.id" class="table-row">
          <span><strong>{{ session.app }}</strong><small>{{ session.id }}</small></span><span>{{ session.region }}</span><span>{{ session.startedAt }}</span><span>{{ session.remaining }}</span><span>{{ session.usage }}</span><StatusBadge :label="session.status" /><button class="row-action" :aria-label="`查看 ${session.app} 会话`" @click="navigate(`/experience/sessions/${session.id}`)"><AppIcon name="arrow" :size="15" /></button>
        </div>
      </div>
    </section>

    <section class="safety-note"><AppIcon name="warning" :size="19" /><div><strong>体验数据会自动清理</strong><p>Session 关闭或超时后释放计算资源，并按策略删除临时上传和生成结果。需要长期保存时，请先下载或转入 Studio。</p></div></section>

    <Transition name="modal">
      <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
        <section class="modal-card">
          <header><div><span class="page-overline">NEW SESSION</span><h2>创建体验 Session</h2><p>创建前会再次检查组织权益、并发与额度。</p></div><button class="icon-button" aria-label="关闭弹窗" @click="showCreate = false"><AppIcon name="close" /></button></header>
          <label class="form-field"><span>选择应用</span><select v-model="selectedAppId"><option v-for="app in apps.filter((item) => item.status !== '申请体验')" :key="app.id" :value="app.id">{{ app.name }} · {{ app.channel }}</option></select></label>
          <div class="selected-app-summary"><span class="app-card-icon" :class="selectedApp.tone"><AppIcon :name="selectedApp.icon" :size="23" /></span><div><strong>{{ selectedApp.name }}</strong><small>{{ selectedApp.gpu }} · {{ selectedApp.duration }}</small></div></div>
          <label class="form-field"><span>运行区域</span><select v-model="region"><option value="cn-east-1">华东 · 上海（推荐）</option><option value="cn-north-1">华北 · 北京</option></select></label>
          <div class="cost-preview"><span>预计预留</span><strong>20 点</strong><small>结束后按实际用量结算</small></div>
          <footer><button class="button secondary" @click="showCreate = false">取消</button><button class="button primary" :disabled="creating" @click="createSession">{{ creating ? '正在创建…' : '创建 Session' }}</button></footer>
        </section>
      </div>
    </Transition>
  </div>
</template>
