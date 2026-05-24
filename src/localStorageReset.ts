export const APP_STORAGE_CLEARED_EVENT = 'app-storage-cleared';

export const clearAppStorage = () => {
  localStorage.clear();
  window.dispatchEvent(new Event(APP_STORAGE_CLEARED_EVENT));
};
