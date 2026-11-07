/**
 * @jest-environment jsdom
 */

import { initDemoNotice } from '../js/shell.js';
import { initDemoLoginHint } from '../js/pages/auth.js';

describe('Demo Mode UI Enhancements', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  describe('initDemoNotice', () => {
    test('Renders dismissible notice when demoMode is true', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ demoMode: true })
      });

      await initDemoNotice();

      const notice = document.querySelector('.demo-notice');
      expect(notice).not.toBeNull();
      expect(notice.textContent).toContain('Demo deployment: uploaded files reset when the server goes to sleep.');

      // Dismiss notice
      const closeBtn = notice.querySelector('.demo-notice-close');
      expect(closeBtn).not.toBeNull();
      closeBtn.click();

      expect(document.querySelector('.demo-notice')).toBeNull();
      expect(sessionStorage.getItem('dismissed-demo-notice')).toBe('true');
    });

    test('Does not render notice when demoMode is false', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ demoMode: false })
      });

      await initDemoNotice();
      expect(document.querySelector('.demo-notice')).toBeNull();
    });

    test('Does not render notice when previously dismissed in session', async () => {
      sessionStorage.setItem('dismissed-demo-notice', 'true');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ demoMode: true })
      });

      await initDemoNotice();
      expect(document.querySelector('.demo-notice')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('initDemoLoginHint', () => {
    test('Renders login autofill hint and button when demoMode is true', async () => {
      document.body.innerHTML = `
        <div id="panel-login">
          <form id="form-login">
            <input id="login-identifier" type="text" />
            <input id="login-password" type="password" />
            <button id="btn-login-submit" type="submit">Sign In</button>
          </form>
        </div>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ demoMode: true })
      });

      await initDemoLoginHint();

      const hint = document.querySelector('.auth-demo-hint');
      expect(hint).not.toBeNull();
      expect(hint.textContent).toContain('clara@example.com / Password123');

      const fillBtn = hint.querySelector('.auth-demo-btn');
      expect(fillBtn).not.toBeNull();

      // Click "Use demo account"
      fillBtn.click();

      expect(document.getElementById('login-identifier').value).toBe('clara@example.com');
      expect(document.getElementById('login-password').value).toBe('Password123');
    });

    test('Does not render hint when demoMode is false', async () => {
      document.body.innerHTML = `
        <div id="panel-login">
          <form id="form-login">
            <input id="login-identifier" type="text" />
            <input id="login-password" type="password" />
          </form>
        </div>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ demoMode: false })
      });

      await initDemoLoginHint();
      expect(document.querySelector('.auth-demo-hint')).toBeNull();
    });
  });
});

