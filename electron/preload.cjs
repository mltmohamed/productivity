const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('questApi', {
  getState: () => ipcRenderer.invoke('state:get'),
  createProject: (payload) => ipcRenderer.invoke('project:create', payload),
  updateProject: (payload) => ipcRenderer.invoke('project:update', payload),
  deleteProject: (id) => ipcRenderer.invoke('project:delete', id),
  createQuest: (payload) => ipcRenderer.invoke('quest:create', payload),
  updateQuest: (payload) => ipcRenderer.invoke('quest:update', payload),
  deleteQuest: (id) => ipcRenderer.invoke('quest:delete', id),
  completeQuest: (id) => ipcRenderer.invoke('quest:complete', id),
  reorderQuests: (ids) => ipcRenderer.invoke('quest:reorder', ids),
  updateSettings: (payload) => ipcRenderer.invoke('settings:update', payload),
  createTransaction: (payload) => ipcRenderer.invoke('finance:create', payload),
  deleteTransaction: (id) => ipcRenderer.invoke('finance:delete', id),
});
