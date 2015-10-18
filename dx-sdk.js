/**
 * 多协云蓝牙温度记录仪JS-SDK
 * 依赖ble插件https://github.com/don/cordova-plugin-ble-central
 * @version 1.0.0
 * @author wq@zlzkj.com
 */
define(function() {

  var config = {
    onLoading: null,
    onComplete: null,
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

  sys.connect = function(device_id, onSuccess, onError) {
    window.ble.connect(device_id, onSuccess, onError);
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

  sys.disconnect = function(device_id, onSuccess, onError) {
    window.ble.disconnect(device_id, onSuccess, onError);
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
  api.execute = function(peripheral, command, onSuccess) {
    config.onLoading && config.onLoading();
    sys.write(peripheral, command, function(){

      var isReceiving = false;
      var isReceived = false;
      var totalData = [];
      var totalLength = 0;

      var t1 = setTimeout(function(){
        if (!isReceiving) {
          // sys.stopNotify(peripheral);
          clearTimeout(t2);
          config.alert("响应超时，10秒内未收到任何数据");
        }
      },1000*10);

      var t2 = setTimeout(function(){
        if (!isReceiving) {
          // sys.stopNotify(peripheral);
          config.alert("数据接收超时，1分钟内未收到完整数据");
        }
      },1000*60*1);

      sys.startNotify(peripheral, function(data){
        // 蓝牙数据传输每组20条记录，多余20条会自动拆分成多个Notify发送
        // 累加每次Notify发送过来的数据
        // Array.prototype.push.apply(totalData, data);
        totalData = totalData.concat(data);
        // 计算本次报文总长度，按照多协文档第2位是长度位，长度为不含前面4位，所以加4
        totalLength = 4 + parseInt(totalData[1], 16);
        if (totalLength == totalData.length) {
          isReceived = true;
          clearTimeout(t2);
          // sys.stopNotify(peripheral);
          config.onComplete && config.onComplete();
          onSuccess && onSuccess(totalData); //当前方案是数据全部读完再回调
        }
        if (!isReceiving) {
          isReceiving = true;
          clearTimeout(t1);
        }
      }, function(errorMsg){
        config.onComplete && config.onComplete();
        config.alert("数据接收失败:" + errorMsg);
      });

    }, function(errorMsg){

      config.alert("指令\"" + command + "\"发送失败:" + errorMsg);
      config.onComplete && config.onComplete();

    });
  }

  api.translator = {
    ascii: function(data) {
      var str = "";
      data.map(function(item){
        var code = parseInt(item, 16);
        if (code != 0) {
          str += String.fromCharCode(code);
        }
      });
      return str;
    },
    float: function(data) {
      var str = "";
      data.map(function(item){
        str += parseInt(item, 16) + ".";
      });
      return str.substr(0, str.length-1);
    },
    int: function(data) {
      var str = "";
      data.map(function(item){
        str += parseInt(item, 16);
      });
      return str;
    },
    time: function(data) {
      function fixZero(num) {
        return num < 10 ? "0" + num : num;
      }
      var str = "";
      var time = data.join("");
      var date = new Date(parseInt(time, 16) * 1000);
      var y = date.getFullYear();
      var m = fixZero(date.getMonth() + 1);
      var d = fixZero(date.getDate());
      var hh = fixZero(date.getHours());
      var mm = fixZero(date.getMinutes());
      var ss = fixZero(date.getSeconds());
      return y + "-" + m + "-" + d + " " + hh + ":" + mm + ":" + ss;
    },
    literal: function(data, separator) {
      if (!separator) {
        separator = "";
      }
      return data.join(separator);
    }
  };

  //05获取记录仪状态
  api.status = function(peripheral, onSuccess) {

    api.execute(peripheral, "7F 00 05 F8", function(data){
      // [0x7F][1_LEN][0x05][SUM][8_MODULE][8_ID][8_KEY][4_TIME][2_VER] [2_VOLTAGE][16_NAME][8_0x00]
      var json = {
        module: api.translator.ascii(data.slice(4,12)),
        id: api.translator.ascii(data.slice(12,20)),
        key: api.translator.ascii(data.slice(20,28)),
        time: api.translator.time(data.slice(28,32)),
        ver: "v" + api.translator.float(data.slice(32,34)),
        voltage: api.translator.float(data.slice(34,36)) + "mV",
        name: api.translator.ascii(data.slice(36,44))
      };
      onSuccess && onSuccess(json);
    });
    
  }

  return {
    setConfig: setConfig,
    config: config,
    sys: sys,
    api: api
  }

});