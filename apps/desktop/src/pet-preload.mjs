import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('dshDesktopPet', {
  begin: () => ipcRenderer.send('dsh-pet-drag-start'),
  move: () => ipcRenderer.send('dsh-pet-drag-move'),
  end: () => ipcRenderer.send('dsh-pet-drag-end'),
})
