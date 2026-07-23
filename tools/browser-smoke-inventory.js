"use strict";

module.exports = Object.freeze([
  Object.freeze({
    id: "production-start-button",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-screen-start-button'))",
    actionExpression: "document.querySelector('#start-screen-start-button').click()",
    successExpression: "document.querySelector('#start-screen')?.hidden === true && document.querySelector('#initial-selection-area')?.hidden === false && Boolean(document.querySelector('.initial-selection-card-button'))",
    obligation: "生产入口无未捕获异常、完成 SetiRandomizer 装配，且“开始游戏”可进入初始选择",
    counterexample: "app.js 初始化异常导致公开 API 或事件未装配，或点击后启动页/初始选择状态错误",
  }),
  Object.freeze({
    id: "page-projection-action",
    file: "randomizer/app/browser-host/browser-host.browser-smoke.html",
    resultSelector: "body",
    resultAttribute: "data-result",
    obligation: "真实页面装配、projection 隐私、人类 Action 与 resident renderer",
    counterexample: "隐藏 deck 泄漏、ViewState 进入规则端口或 DOM Action 未原样提交",
  }),
  Object.freeze({
    id: "human-card-decision",
    file: "randomizer/app/browser-host/card-decision-ui.browser-smoke.html",
    resultSelector: "#card-decision-smoke-result",
    resultAttribute: "data-ok",
    obligation: "真实 DOM 多步卡牌 Decision 经公共输入端口推进",
    counterexample: "清空 DOM 后无法重建、非候选 choice 或隐藏手牌泄漏",
  }),
  Object.freeze({
    id: "policy-input",
    file: "randomizer/app/browser-host/policy-input-adapter.browser-smoke.html",
    resultSelector: "body",
    resultAttribute: "data-result",
    obligation: "Policy 在 Chrome 中只经与人类共用的 Action/Decision input port",
    counterexample: "Policy 访问 renderer/picker 或绕过正式提交端口",
  }),
  Object.freeze({
    id: "save-recovery",
    file: "randomizer/app/browser-host/browser-services.browser-smoke.html",
    resultSelector: "body",
    resultAttribute: "data-result",
    obligation: "真实 reload 后恢复 composition envelope 与独立 ViewState",
    counterexample: "刷新丢失 committed state、ViewState 或 facade 泄漏 authority",
  }),
  Object.freeze({
    id: "industry-alien-decision",
    file: "randomizer/app/browser-host/industry-alien-decision-ui.browser-smoke.html",
    resultSelector: "#industry-alien-decision-smoke-result",
    resultAttribute: "data-ok",
    obligation: "真实 DOM 公司/外星多 Decision、owner 隐私与固定 session trace",
    counterexample: "非 owner 看到选择、旧 resolver 被调用或 journal 丢步骤",
  }),
]);
