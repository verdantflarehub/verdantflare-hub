<script setup>
import AppIcon from "../components/AppIcon.vue";
import { navigate } from "../router";

defineProps({ path: String });
</script>

<template><div class="not-found-page"><div class="state-icon"><AppIcon name="search" :size="27" /></div><span class="page-overline">404 / FORBIDDEN</span><h1>这个页面不可用</h1><p>路由不存在，或当前组织没有访问此业务区域的权限。</p><button class="button primary" @click="navigate('/')">返回总览</button></div></template>
