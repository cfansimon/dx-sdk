/**
 * 多协云蓝牙温度记录仪JS-SDK
 * 依赖ble插件https://github.com/don/cordova-plugin-ble-central
 * @version 1.0.0
 * @author wq@zlzkj.com
 */
define(function() {

    var config = {
        timeout: {
            connect: 30
        },
        alert: function(msg) {
            alert(msg);
        }
    };

    var setConfig = function(cfg) {
        for (var i in config) {
            if (cfg[i]) {
                config[i] = cfg[i];
            }
        }
    }

    function getCharacteristicByHC08(characteristics) {
        for (var i in characteristics) {
          //客户提供的HC08蓝牙模块的UUID为0000ffe1-0000-1000-8000-00805f9b34fb
            if (characteristics[i].characteristic == "ffe1") {
                return characteristics[i];
            }
        };
        return "该蓝牙模块不是HC-08模块，无法读写";
    }

    function commandToBytes(command) {
        var arr = command.split(" ");
        var buffer = new ArrayBuffer(arr.length);
        var data = new Uint8Array(buffer);
        for (var i in arr) {
            data[i] = parseInt(arr[i], 16);
        };
        return data.buffer;
    }

    function bytesToArray(buffer) {
        var data = new Uint8Array(buffer);
        var hexArr = [];
        for (var i in data) {
            var hex = data[i].toString(16);
            hex = "00".substr(0, 2 - hex.length) + hex; 
            hexArr.push(hex.toUpperCase());
        };
        return hexArr;
    }

    var sys = {};
    
    sys.startScan = function(services, onSuccess, onError) {
        if (window.ble) {
            window.ble.isEnabled(function() {
                window.ble.startScan(services, onSuccess, onError);
            },function() {
                config.alert("请打开蓝牙");
            });
        } else {
            config.alert("系统异常，未找到ble插件");
        }
    }

    sys.stopScan = function(onSuccess, onError) {
        window.ble.stopScan(onSuccess, onError);
    }

    sys.connect = function(deviceId, onSuccess, onError, onDisconnected) {
        var isConnected = false;
        var t = setTimeout(function(){
            if (isConnected) {
                sys.disconnect(deviceId); //确保断开
            }
            onError && onError("连接超时，" + config.timeout.connect + "秒内未连接成功");
        },1000*config.timeout.connect);

        window.ble.connect(deviceId, function(peripheral) {
            isConnected = true;
            clearTimeout(t);
            onSuccess && onSuccess(peripheral);
        }, function(errorMsg) {
            isConnected = false;
            clearTimeout(t);
            // 用Disconnected判断是连接失败还是连接成功后再断开
            if (errorMsg == 'Disconnected') {
                onDisconnected && onDisconnected();
            } else {
                onError && onError(errorMsg);
            }
        });
        // success中返回peripheral对象，类似下列结构
        // {
        //     "characteristics": [{
        //         "descriptors": [{
        //             "uuid": "2902"
        //         }, {
        //             "uuid": "2901"
        //         }],
        //         "characteristic": "ffe1",
        //         "service": "ffe0",
        //         "properties": ["Read", "WriteWithoutResponse", "Notify"]
        //     }],
        //     "advertising": {},
        //     "id": "20:C3:8F:FD:6D:76",
        //     "services": ["ffe0"],
        //     "rssi": -46,
        //     "name": "LANYA"
        // }
    }

    sys.disconnect = function(deviceId, onSuccess, onError) {
        window.ble.disconnect(deviceId, onSuccess, onError);
    }

    sys.isConnected = function(deviceId, onSuccess, onFail) {
        window.ble.isConnected(deviceId, onSuccess, onFail);
    }

    sys.write = function(peripheral, data, onSuccess, onError) {
        var res = getCharacteristicByHC08(peripheral.characteristics);
        if (typeof res == "object") {
            window.ble.writeWithoutResponse(peripheral.id, res.service, res.characteristic, commandToBytes(data), onSuccess, onError);
        } else {
            onError && onError(res);
        }
    }

    sys.startNotify = function(peripheral, onSuccess, onError) {
      var res = getCharacteristicByHC08(peripheral.characteristics);
      if (typeof res == "object") {
            window.ble.startNotification(peripheral.id, res.service, res.characteristic, function(buffer){
                onSuccess(bytesToArray(buffer));
            }, onError);
      } else {
            onError && onError(res);
      }
    }

    sys.stopNotify = function(peripheral, onSuccess, onError) {
        var res = getCharacteristicByHC08(peripheral.characteristics);
        if (typeof res == "object") {
            window.ble.stopNotification(peripheral.id, res.service, res.characteristic, onSuccess, onError);
        } else {
            onError && onError(res);
        }
    }

    var api = {};

    //api底层方法，传入多协文档的16进制指令，输出记录仪返回的16进制数据，未做数据解析
    api.execute = function(peripheral, command, isNeedResponse, onSuccess, onError, onProgress) {
        onProgress && onProgress([1, 100]); //模拟一点进度
        sys.write(peripheral, command, function() {

            if (isNeedResponse) {

                var totalData = [];
                var totalLength = 0;

                sys.startNotify(peripheral, function(data) {
                    //关闭loading提示，可以在onProgress里启用进度条提示
                    // 蓝牙数据传输每组20条记录，多余20条会自动拆分成多个Notify发送
                    // 累加每次Notify发送过来的数据
                    // Array.prototype.push.apply(totalData, data);
                    totalData = totalData.concat(data);
                    console.log(data.join(" "));
                    if (totalData.length < 4) { //返回数据至少有4位
                        onError && onError("模块返回的数据长度有误，当前返回值为" + totalData.join(" "));
                    } else {
                        // 计算本次报文总长度，按照多协文档第2位是长度位，长度为不含前面4位，所以加4
                        totalLength = 4 + parseInt(totalData[1], 16);
                        onProgress && onProgress([totalData.length, totalLength]);
                        if (totalLength == totalData.length) {
                            onSuccess && onSuccess(totalData); //当前方案是数据全部读完再回调
                            sys.stopNotify(peripheral);
                        }
                    }
                }, function(errorMsg){
                    onError && onError("数据接收失败:" + errorMsg);
                });
            } else { //不需要接收数据返回
                onSuccess && onSuccess();
            }

        }, function(errorMsg) {
            onError && onError("指令\"" + command + "\"发送失败:" + errorMsg);
        });
    }

    //计算指令的第4位
    api.insertCommandSum = function(command) {
        var sum = 0;
        var arr = command.split(" ");
        arr.slice(1).reverse().map(function(item) {
            sum = (0xff)&( sum + ~parseInt(item, 16));
        });
        sum = sum.toString(16);
        arr[3] = sum;
        return arr.join(" ").toUpperCase();
    }

    api.translator = {
        ascii: function(data) {
            var str = "";
            data.map(function(item) {
                var code = parseInt(item, 16);
                if (code != 0) {
                    str += String.fromCharCode(code);
                }
            });
            return str;
        },
        binary: function(data) {
            var str = "";
            data.reverse().map(function(item) {
                str += parseInt(item, 16).toString(2);
            });
            return str;
        },
        float: function(data) {
            var str = "";
            data.reverse().map(function(item) {
                str += parseInt(item, 16) + ".";
            });
            return str.substr(0, str.length-1);
        },
        int: function(data) {
            // 整数需要变反，8F F2 22 56 变成为 0x5622f28f
            return parseInt(data.reverse().join(""), 16);
        },
        timestamp2Hex: function(timestamp) {
            var str = parseInt(timestamp).toString(16);
            var arr = [];
            for (var i = 0; i < str.length; i+=2) {
                arr.push(str.substr(i, 2));
            };
            return arr.reverse().join(" ").toUpperCase();
        },
        temp: function(data) {
            // 温度也需要变反
            return (parseInt(data.reverse().join(""), 16)/16).toFixed(2);
        },
        literal: function(data, separator) {
            if (!separator) {
                separator = "";
            }
            return data.join(separator);
        }
    };

    //10 生效参数并清除FLASH记录指针
    api.reset = function(peripheral) {
        api.execute(peripheral, "7F 00 10 ED", false);
    };

    //把手机时间同步到记录仪中，04 更新记录仪中时间
    api.syncTime = function(peripheral, onSuccess, onError, onProgress) {
        api.execute(peripheral, api.insertCommandSum("7F 04 04 00 " + api.translator.timestamp2Hex(Math.floor(new Date().getTime() / 1000))), true, function(data) {
            // [0x7F][LEN][0x04][SUM][4_TIME]
            var json = {
                time: api.translator.int(data.slice(4,8))
            }
            onSuccess && onSuccess(json);
        }, onError, onProgress);
    };

    //05获取记录仪状态
    api.status = function(peripheral, onSuccess, onError, onProgress) {

        api.execute(peripheral, "7F 00 05 F8", true, function(data) {
            // [0x7F][1_LEN][0x05][SUM][8_MODULE][8_ID][8_KEY][4_TIME][2_VER] [2_VOLTAGE][16_NAME][8_0x00]
            var json = {
                module: api.translator.ascii(data.slice(4,12)),
                id: api.translator.ascii(data.slice(12,20)),
                key: api.translator.ascii(data.slice(20,28)),
                time: api.translator.int(data.slice(28,32)),
                ver: "v" + api.translator.float(data.slice(32,34)),
                voltage: api.translator.int(data.slice(34,36)) + "mV",
                name: api.translator.ascii(data.slice(36,44))
            };
            onSuccess && onSuccess(json);
        }, onError, onProgress);
      
    };

    //08 读取当前变化量
    api.currentData = function(peripheral, onSuccess, onError, onProgress) {

        api.execute(peripheral, "7F 00 08 F5", true, function(data) {
            // [0x7F][LEN][0x08][SUM][1_STATUS][1_RESERVE][2_TEMP][4_BASE][4_NUM]
            var json = {
                status: api.translator.binary(data.slice(4,5)),
                temp: api.translator.temp(data.slice(6,8))
            };
            onSuccess && onSuccess(json);
        }, onError, onProgress);
      
    }

    return {
        setConfig: setConfig,
        config: config,
        sys: sys,
        api: api
    }

});