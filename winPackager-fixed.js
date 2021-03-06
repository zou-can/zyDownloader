"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.WinPackager = undefined;

var _bluebirdLstC;

function _load_bluebirdLstC() {
    return _bluebirdLstC = require("bluebird-lst-c");
}

var _bluebirdLstC2;

function _load_bluebirdLstC2() {
    return _bluebirdLstC2 = _interopRequireDefault(require("bluebird-lst-c"));
}

let checkIcon = (() => {
    var _ref = (0, (_bluebirdLstC || _load_bluebirdLstC()).coroutine)(function* (file) {
        const fd = yield (0, (_fsExtraP || _load_fsExtraP()).open)(file, "r");
        const buffer = new Buffer(512);
        try {
            yield (0, (_fsExtraP || _load_fsExtraP()).read)(fd, buffer, 0, buffer.length, 0);
        } finally {
            yield (0, (_fsExtraP || _load_fsExtraP()).close)(fd);
        }
        if (!isIco(buffer)) {
            throw new Error(`Windows icon is not valid ico file, please fix "${ file }"`);
        }
        const sizes = parseIco(buffer);
        for (const size of sizes) {
            if (size.w >= 256 && size.h >= 256) {
                return;
            }
        }
        throw new Error(`Windows icon size must be at least 256x256, please fix "${ file }"`);
    });

    return function checkIcon(_x) {
        return _ref.apply(this, arguments);
    };
})();

var _codeSign;

function _load_codeSign() {
    return _codeSign = require("./codeSign");
}

var _platformPackager;

function _load_platformPackager() {
    return _platformPackager = require("./platformPackager");
}

var _metadata;

function _load_metadata() {
    return _metadata = require("./metadata");
}

var _path = _interopRequireWildcard(require("path"));

var _log;

function _load_log() {
    return _log = require("./util/log");
}

var _util;

function _load_util() {
    return _util = require("./util/util");
}

var _fsExtraP;

function _load_fsExtraP() {
    return _fsExtraP = require("fs-extra-p");
}

var _windowsCodeSign;

function _load_windowsCodeSign() {
    return _windowsCodeSign = require("./windowsCodeSign");
}

var _targetFactory;

function _load_targetFactory() {
    return _targetFactory = require("./targets/targetFactory");
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class WinPackager extends (_platformPackager || _load_platformPackager()).PlatformPackager {
    constructor(info) {
        super(info);
        const subjectName = this.platformSpecificBuildOptions.certificateSubjectName;
        if (subjectName == null) {
            const certificateFile = this.platformSpecificBuildOptions.certificateFile;
            if (certificateFile != null) {
                const certificatePassword = this.getCscPassword();
                this.cscInfo = (_bluebirdLstC2 || _load_bluebirdLstC2()).default.resolve({
                    file: certificateFile,
                    password: certificatePassword == null ? null : certificatePassword.trim()
                });
            } else {
                const cscLink = process.env.WIN_CSC_LINK || this.options.cscLink;
                if (cscLink != null) {
                    this.cscInfo = (0, (_codeSign || _load_codeSign()).downloadCertificate)(cscLink, info.tempDirManager).then(path => {
                        return {
                            file: path,
                            password: this.getCscPassword()
                        };
                    });
                } else {
                    this.cscInfo = (_bluebirdLstC2 || _load_bluebirdLstC2()).default.resolve(null);
                }
            }
        } else {
            this.cscInfo = (_bluebirdLstC2 || _load_bluebirdLstC2()).default.resolve({
                subjectName: subjectName
            });
        }
    }
    get defaultTarget() {
        return ["nsis"];
    }
    doGetCscPassword() {
        return this.platformSpecificBuildOptions.certificatePassword || process.env.WIN_CSC_KEY_PASSWORD || super.doGetCscPassword();
    }
    createTargets(targets, mapper, cleanupTasks) {
        for (const name of targets) {
            if (name === (_targetFactory || _load_targetFactory()).DIR_TARGET) {
                continue;
            }
            const targetClass = (() => {
                switch (name) {
                    case "nsis":
                        return require("./targets/nsis").default;
                    case "squirrel":
                        return require("./targets/squirrelWindows").default;
                    case "appx":
                        return require("./targets/appx").default;
                    default:
                        return null;
                }
            })();
            mapper(name, outDir => targetClass === null ? (0, (_targetFactory || _load_targetFactory()).createCommonTarget)(name, outDir, this) : new targetClass(this, outDir));
        }
    }
    get platform() {
        return (_metadata || _load_metadata()).Platform.WINDOWS;
    }
    getIconPath() {
        if (this.iconPath == null) {
            this.iconPath = this.getValidIconPath();
        }
        return this.iconPath;
    }
    getValidIconPath() {
        var _this = this;

        return (0, (_bluebirdLstC || _load_bluebirdLstC()).coroutine)(function* () {
            let iconPath = _this.platformSpecificBuildOptions.icon || _this.config.icon;
            if (iconPath != null && !iconPath.endsWith(".ico")) {
                iconPath += ".ico";
            }
            iconPath = iconPath == null ? yield _this.getDefaultIcon("ico") : _path.resolve(_this.projectDir, iconPath);
            if (iconPath == null) {
                return null;
            }
            yield checkIcon(iconPath);
            return iconPath;
        })();
    }
    sign(file) {
        var _this2 = this;

        return (0, (_bluebirdLstC || _load_bluebirdLstC()).coroutine)(function* () {
            const cscInfo = yield _this2.cscInfo;
            if (cscInfo == null) {
                const forceCodeSigningPlatform = _this2.platformSpecificBuildOptions.forceCodeSigning;
                if (forceCodeSigningPlatform == null ? _this2.config.forceCodeSigning : forceCodeSigningPlatform) {
                    throw new Error(`App is not signed and "forceCodeSigning" is set to true, please ensure that code signing configuration is correct, please see https://github.com/electron-userland/electron-builder/wiki/Code-Signing`);
                }
                return;
            }
            (0, (_log || _load_log()).log)(`Signing ${ _path.basename(file) } (certificate file "${ cscInfo.file }")`);
            yield _this2.doSign({
                path: file,
                cert: cscInfo.file,
                subjectName: cscInfo.subjectName,
                password: cscInfo.password,
                name: _this2.appInfo.productName,
                site: yield _this2.appInfo.computePackageUrl(),
                options: _this2.platformSpecificBuildOptions
            });
        })();
    }
    //noinspection JSMethodCanBeStatic
    doSign(options) {
        return (0, (_windowsCodeSign || _load_windowsCodeSign()).sign)(options);
    }
    signAndEditResources(file) {
        var _this3 = this;

        return (0, (_bluebirdLstC || _load_bluebirdLstC()).coroutine)(function* () {
            const appInfo = _this3.appInfo;
			var originalFilename = appInfo.metadata.build.originalFilename;
			console.log("originalFilename:"+originalFilename);
            const args = [file, "--set-version-string", "CompanyName", appInfo.companyName, "--set-version-string", "FileDescription", appInfo.productName, "--set-version-string", "ProductName", appInfo.productName, "--set-version-string", "InternalName", _path.basename(appInfo.productFilename, ".exe"), "--set-version-string", "LegalCopyright", appInfo.copyright, "--set-version-string", "OriginalFilename", originalFilename, "--set-file-version", appInfo.buildVersion, "--set-product-version", appInfo.version];
            (0, (_util || _load_util()).use)(_this3.platformSpecificBuildOptions.legalTrademarks, function (it) {
                return args.push("--set-version-string", "LegalTrademarks", it);
            });
            (0, (_util || _load_util()).use)((yield _this3.getIconPath()), function (it) {
                return args.push("--set-icon", it);
            });
            const rceditExecutable = _path.join((yield (0, (_windowsCodeSign || _load_windowsCodeSign()).getSignVendorPath)()), "rcedit.exe");
            const isWin = process.platform === "win32";
            if (!isWin) {
                args.unshift(rceditExecutable);
            }
            yield (0, (_util || _load_util()).exec)(isWin ? rceditExecutable : "wine", args);
            yield _this3.sign(file);
        })();
    }
    postInitApp(appOutDir) {
        var _this4 = this;

        return (0, (_bluebirdLstC || _load_bluebirdLstC()).coroutine)(function* () {
            const executable = _path.join(appOutDir, `${ _this4.appInfo.productFilename }.exe`);
            yield (0, (_fsExtraP || _load_fsExtraP()).rename)(_path.join(appOutDir, "electron.exe"), executable);
            yield _this4.signAndEditResources(executable);
        })();
    }
}
exports.WinPackager = WinPackager;

function parseIco(buffer) {
    if (!isIco(buffer)) {
        throw new Error("buffer is not ico");
    }
    const n = buffer.readUInt16LE(4);
    const result = new Array(n);
    for (let i = 0; i < n; i++) {
        result[i] = {
            w: buffer.readUInt8(6 + i * 16) || 256,
            h: buffer.readUInt8(7 + i * 16) || 256
        };
    }
    return result;
}
function isIco(buffer) {
    return buffer.readUInt16LE(0) === 0 && buffer.readUInt16LE(2) === 1;
}
//# sourceMappingURL=winPackager.js.map