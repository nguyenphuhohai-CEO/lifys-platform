import assert from 'node:assert/strict';
import test from 'node:test';

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

import App from './App.jsx';
import { STORAGE_KEYS } from './utils/storage.js';

const SANITIZED_DEFAULT_PROFILE = JSON.stringify({
  name: '',
  age: '',
  city: '',
  bio: '',
  interests: '',
  mode: 'amoureux',
  avatar: '',
});

function defineGlobalProperty(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    configurable: true,
    writable: true,
  });
}

function mountApp(options = {}) {
  const dom = new JSDOM('<!doctype html><html lang="fr"><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  });

  const previousGlobals = new Map([
    ['window', globalThis.window],
    ['document', globalThis.document],
    ['navigator', globalThis.navigator],
    ['HTMLElement', globalThis.HTMLElement],
    ['Node', globalThis.Node],
    ['localStorage', globalThis.localStorage],
    ['IS_REACT_ACT_ENVIRONMENT', globalThis.IS_REACT_ACT_ENVIRONMENT],
    ['setTimeout', globalThis.setTimeout],
    ['clearTimeout', globalThis.clearTimeout],
  ]);

  defineGlobalProperty(globalThis, 'window', dom.window);
  defineGlobalProperty(globalThis, 'document', dom.window.document);
  defineGlobalProperty(globalThis, 'navigator', dom.window.navigator);
  defineGlobalProperty(globalThis, 'HTMLElement', dom.window.HTMLElement);
  defineGlobalProperty(globalThis, 'Node', dom.window.Node);
  defineGlobalProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  defineGlobalProperty(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = previousGlobals.get('setTimeout')(callback, delay, ...args);
    timer?.unref?.();
    return timer;
  });
  defineGlobalProperty(globalThis, 'clearTimeout', previousGlobals.get('clearTimeout'));

  if (options.storageUnavailable) {
    defineGlobalProperty(dom.window, 'localStorage', undefined);
    defineGlobalProperty(globalThis, 'localStorage', undefined);
  } else {
    if (options.corruptedProfile) {
      dom.window.localStorage.setItem(STORAGE_KEYS.profile, '{oops');
    }

    defineGlobalProperty(globalThis, 'localStorage', dom.window.localStorage);
  }

  const container = dom.window.document.getElementById('root');
  const root = createRoot(container);

  act(() => {
    root.render(<App />);
  });

  return {
    container,
    dom,
    root,
    restore() {
      act(() => {
        root.unmount();
      });
      dom.window.close();

      previousGlobals.forEach((value, key) => {
        if (typeof value === 'undefined') {
          delete globalThis[key];
          return;
        }

        defineGlobalProperty(globalThis, key, value);
      });
    },
  };
}

test('App shows temporary-session messaging when browser storage is unavailable', () => {
  const app = mountApp({ storageUnavailable: true });

  try {
    assert.match(app.container.textContent, /Le stockage local du navigateur est indisponible/);
    assert.match(app.container.textContent, /Mémoire de session uniquement/);
    assert.match(app.container.textContent, /Mode temporaire/);
  } finally {
    app.restore();
  }
});

test('App surfaces repaired-storage messaging when corrupted JSON is recovered', () => {
  const app = mountApp({ corruptedProfile: true });

  try {
    assert.equal(app.dom.window.localStorage.getItem(STORAGE_KEYS.profile), SANITIZED_DEFAULT_PROFILE);
    assert.match(app.container.textContent, /Clés réparées automatiquement : profil\./);
    assert.match(app.container.textContent, /Données locales réparées/);
  } finally {
    app.restore();
  }
});
