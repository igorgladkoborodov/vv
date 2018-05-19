import screen from './screen';
import { eventKeyCode } from './input';

const { remote } = global.require('electron');

const currentWindow = remote.getCurrentWindow();
let nvim;
let cols;
let rows;

const charWidth = () => 7.2;
const charHeight = () => 15;

const handleKeydown = (event) => {
  const key = eventKeyCode(event);
  if (key) {
    nvim.input(key);
  }
};

const resize = () => {
  const newCols = Math.floor(window.innerWidth / charWidth());
  const newRows = Math.floor(window.innerHeight / charHeight());
  if (newCols !== cols || newRows !== rows) {
    cols = newCols;
    rows = newRows;
    nvim.uiTryResize(cols, rows);
  }
};

let resizeTimeout;
const handleResize = () => {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  resizeTimeout = setTimeout(resize, 500);
};

const handleNotification = async (method, args) => {
  if (method === 'redraw') {
    for (let i = 0; i < args.length; i += 1) {
      const [cmd, ...props] = args[i];
      try {
        // console.log(cmd, props);
        screen[cmd](props);
      } catch (e) {
        console.warn('Unknown redraw command', cmd, props); // eslint-disable-line no-console
      }
    }
  } else if (method === 'vvim:fullscreen') {
    currentWindow.setSimpleFullScreen(!!args[0]);
    currentWindow.webContents.focus();
  } else {
    console.warn('Unknown notification', method, args); // eslint-disable-line no-console
  }
};

const handlePaste = async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const clipboardText = event.clipboardData
    .getData('text')
    .replace('<', '<lt>');
  const { mode } = await nvim.mode;
  if (mode === 'i') {
    await nvim.command('set paste');
    await nvim.input(clipboardText);
    await nvim.command('set nopaste');
  } else {
    nvim.input(mode === 'c' ? clipboardText : '"*p');
  }
};

const handleCopy = async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const { mode } = await nvim.mode;
  if (mode === 'v' || mode === 'V') {
    nvim.input('"*y');
  }
};

let mouseButtonDown;
const handleMousedown = (event) => {
  event.preventDefault();
  event.stopPropagation();
  mouseButtonDown = true;
  nvim.input(`<LeftMouse><${Math.floor(event.clientX / 7.2)}, ${Math.floor(event.clientY / 15)}>`);
};

const handleMouseup = (event) => {
  if (mouseButtonDown) {
    event.preventDefault();
    event.stopPropagation();
    mouseButtonDown = false;
  }
};

const handleMousemove = (event) => {
  if (mouseButtonDown) {
    event.preventDefault();
    event.stopPropagation();
    nvim.input(`<LeftDrag><${Math.floor(event.clientX / 7.2)}, ${Math.floor(event.clientY / 15)}>`);
  }
};

const closeWindow = () => {
  currentWindow.close();
};

const initNvim = async () => {
  nvim = currentWindow.nvim;
  // window.nvim = nvim;

  nvim.uiAttach(100, 50, { ext_cmdline: false });

  nvim.on('notification', (method, args) => {
    handleNotification(method, args);
  });

  nvim.on('disconnect', closeWindow);

  nvim.command('set mouse=a'); // Enable Mouse
  nvim.command('map <D-w> :q<CR>'); // Enable Mouse

  nvim.command('command Fu call rpcnotify(0, "vvim:fullscreen", 1)');
  nvim.command('command Nofu call rpcnotify(0, "vvim:fullscreen", 0)');
  nvim.subscribe('vvim:fullscreen');

  resize();

  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('mousedown', handleMousedown);
  document.addEventListener('mouseup', handleMouseup);
  document.addEventListener('mousemove', handleMousemove);
  document.addEventListener('paste', handlePaste);
  document.addEventListener('copy', handleCopy);

  window.addEventListener('resize', handleResize);
};

document.addEventListener('DOMContentLoaded', () => initNvim());
