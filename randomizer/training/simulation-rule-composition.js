"use strict";

// Simulation Host 只安装 game 层 Production Kernel；规则枚举、执行、Decision、
// committed state 与恢复语义全部归 game/production-kernel。
module.exports = require("../game/production-kernel");
