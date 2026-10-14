import { nextTick, onBeforeUnmount, ref, toValue, watch } from "vue";

export const useModal = (open, busy = false) => {
  const dialogRef = ref(null);
  let trigger;
  let savedBodyOverflow;

  const restorePage = () => {
    if (savedBodyOverflow !== undefined) {
      document.body.style.overflow = savedBodyOverflow;
      savedBodyOverflow = undefined;
    }
  };
  const closeModal = () => {
    if (!toValue(busy)) open.value = false;
  };

  watch(open, async (visible) => {
    if (visible) {
      trigger = document.activeElement;
      await nextTick();
      if (!open.value || !dialogRef.value) return;
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      dialogRef.value.showModal();
    } else {
      dialogRef.value?.close();
      restorePage();
      await nextTick();
      if (!open.value && trigger?.isConnected) trigger.focus({ preventScroll: true });
    }
  });

  onBeforeUnmount(restorePage);
  return { dialogRef, closeModal };
};
