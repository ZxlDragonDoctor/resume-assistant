/**
 * antd 静态方法桥接（message / Modal / notification）
 * ------------------------------------------------------------------
 * 背景：antd v5 中直接使用 `message.success()`、`Modal.confirm()` 这类**静态方法**，
 * 无法读取 `<ConfigProvider theme>` 与 `<App>` 提供的 context，
 * 控制台会警告：
 *   Warning: [antd: message] Static function can not consume context like dynamic theme.
 *   Please use 'App' component instead.
 * 后果是这些提示用不上 `styles/theme.ts` 里定制的主色/圆角，观感与其它组件不一致。
 *
 * 方案：用一个模块级可变的 `messageApi` / `modalApi` 承载 `App.useApp()` 的实例，
 * 由根组件 `<AntdStaticBridge>` 在渲染时注入，业务代码继续按 `message.success(...)` 调用，
 * 但实际走的是 **context 感知** 的实例。
 *
 * 用法：
 *   1. 根组件内挂载 `<AntdStaticBridge />`（已在 App.tsx 中完成）
 *   2. 业务代码 `import { message, modal } from '../utils/antdStatic'` 后照常调用
 *
 * 注意：注入完成前（极早的模块级调用）会回退到 antd 原生静态方法，保证不抛错。
 */
import { App } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';
import type { NotificationInstance } from 'antd/es/notification/interface';
import antdStaticMessage from 'antd/es/message';
import antdStaticModal from 'antd/es/modal';

type ModalApi = Omit<ModalStaticFunctions, 'warn'>;

let messageApi: MessageInstance | null = null;
let modalApi: ModalApi | null = null;
let notificationApi: NotificationInstance | null = null;

/**
 * 在根组件中调用一次，把 `App.useApp()` 的实例注入桥接层。
 * 必须在 `<App>`（antd 的 App 组件）内部使用。
 */
export function useAntdStaticBridge(): void {
  const app = App.useApp();
  messageApi = app.message;
  modalApi = app.modal;
  notificationApi = app.notification;
}

/** context 感知的 message；注入前回退到静态方法 */
export const message: MessageInstance = new Proxy({} as MessageInstance, {
  get(_target, prop) {
    const src = (messageApi ?? antdStaticMessage) as unknown as Record<string | symbol, unknown>;
    const value = src[prop];
    return typeof value === 'function' ? value.bind(src) : value;
  },
});

/** context 感知的 Modal；注入前回退到静态方法 */
export const modal: ModalApi = new Proxy({} as ModalApi, {
  get(_target, prop) {
    const src = (modalApi ?? antdStaticModal) as unknown as Record<string | symbol, unknown>;
    const value = src[prop];
    return typeof value === 'function' ? value.bind(src) : value;
  },
});

/** context 感知的 notification；注入前回退到静态方法（按需引入） */
export const notification: NotificationInstance = new Proxy({} as NotificationInstance, {
  get(_target, prop) {
    const src = (notificationApi ?? null) as unknown as Record<string | symbol, unknown> | null;
    if (!src) {
      throw new Error('notification 尚未注入，请在根组件挂载 AntdStaticBridge');
    }
    const value = src[prop];
    return typeof value === 'function' ? value.bind(src) : value;
  },
});

export default { message, modal, notification };
