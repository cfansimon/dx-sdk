# 多协蓝牙温度记录仪SDK API文档
#####说明：本sdk依赖ble插件https://github.com/don/cordova-plugin-ble-central

[TOC]

### 使用说明
* 本SDK采用模块化方式引用，requirejs已测试，假设引入后模块名为"dxsdk"
* 所有接口返回类型为JSON

### 1 SDK全局配置

#### 1.1 配置

    setConfig(json);

** 可配置项 **

| 名称  | 类型  | 必需   | 说明 |
| ---- | ----- | ----- | ---- |
| timeout | object | 否 | 超时参数，单位秒，含connect(连接超时，默认30) |
| alert | function | 否 | 改变alert UI交互，例如可以使用Framework7的模态框弹出方法。默认使用js原生alert方式 |

** 示例 **

```
var alert = function(msg) {
    f7.alert(msg, "提示");
}
dxsdk.setConfig({
    alert: alert
});
```
### 2 蓝牙通信类接口

#### 2.1 扫描蓝牙设备

    sys.startScan(services, onSuccess, onError);

** 参数 **

| 名称  | 类型  | 必需   | 说明 |
| ---- | ----- | ----- | ---- |
| services | array | 是 | List of services to discover, or [] to find all devices |
| onSuccess | function | 是 | Success callback，每次发现一个设备回调一次，回调参数为设备信息device |
| onError | function | 否 | error callback，回调参数为errorMsg |

** 示例 **

```
dxsdk.sys.startScan([], function(device) {
    console.log(JSON.stringify(device));
}, function(errorMsg) {
    alert(errorMsg);
});
```
#### 2.2 结束扫描蓝牙

    sys.stopScan(onSuccess, onError);

** 参数 **

| 名称  | 类型  | 必需   | 说明 |
| ---- | ----- | ----- | ---- |
| onSuccess | function | 否 | Success callback |
| onError | function | 否 | error callback，回调参数为errorMsg |

** 示例 **

```
dxsdk.sys.stopScan([], function() {
    alert("Scan stopped");
}, function(errorMsg) {
    alert("Scan failed, " + errorMsg);
});
```
#### 2.3 连接设备

    sys.connect(device_id, onSuccess, onError);

** 参数 **

| 名称  | 类型  | 必需   | 说明 |
| ---- | ----- | ----- | ---- |
| device_id | string | 是 | 设备mac地址 |
| onSuccess | function | 是 | Success callback，回调参数为peripheral对象，看示例 |
| onError | function | 否 | 连接失败回调，回调参数为errorMsg |
| onDisconnected | function | 否 | 连接断开后的回调 |

** 示例 **

```
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

dxsdk.sys.connect(discoveredDevices[i].id, function(peripheral){
    console.log(JSON.stringify(peripheral));
}, function(errorMsg){
	alert('连接失败：' + errorMsg);
}, function(){
	alert('连接已断开');
});
```
#### 2.4 断开设备连接

    sys.disconnect(device_id, onSuccess, onError);

** 参数 **

| 名称  | 类型  | 必需   | 说明 |
| ---- | ----- | ----- | ---- |
| device_id | string | 是 | 设备mac地址 |
| onSuccess | function | 是 | Success callback |
| onError | function | 否 | error callback，回调参数为errorMsg |

** 示例 **

```
dxsdk.sys.disconnect(deviceId);
```
#### 2.5 向设备写数据

    sys.write(peripheral, data, onSuccess, onError);

** 参数 **

| 名称  | 类型  | 必需   | 说明 |
| ---- | ----- | ----- | ---- |
| peripheral | object | 是 | 设备的peripheral对象，由sys.connect成功回调函数中传回 |
| data | string | 是 | 字符类型的数据 |
| onSuccess | function | 是 | Success callback |
| onError | function | 否 | error callback，回调参数为errorMsg |

** 示例 **

```
dxsdk.sys.write(peripheral, command, function(){
    alert("数据发送成功");
}, function(errorMsg){
    alert("数据发送失败:" + errorMsg);
});
```
#### 2.6 开始接收设备回传数据

    sys.startNotify(peripheral, onSuccess, onError);

** 参数 **

| 名称  | 类型  | 必需   | 说明 |
| ---- | ----- | ----- | ---- |
| peripheral | object | 是 | 设备的peripheral对象，由sys.connect成功回调函数中传回 |
| onSuccess | function | 是 | Success callback，回调函数参数data，是记录仪传回的16进制数据数组 |
| onError | function | 否 | error callback，回调参数为errorMsg |

** 示例 **

```
dxsdk.sys.startNotify(peripheral, function(data){
    console.log(data); //16进制数据数组，需要按照多协的通信协议进一步解析
}, function(errorMsg){
    alert("数据接收失败:" + errorMsg);
});
```
#### 2.7 停止接收设备回传数据

    sys.stopNotify(peripheral, onSuccess, onError);

** 参数 **

| 名称  | 类型  | 必需   | 说明 |
| ---- | ----- | ----- | ---- |
| peripheral | object | 是 | 设备的peripheral对象，由sys.connect成功回调函数中传回 |
| onSuccess | function | 是 | Success callback |
| onError | function | 否 | error callback，回调参数为errorMsg |

** 示例 **

```
dxsdk.sys.stopNotify(peripheral, function(){
    alert("已停止接收数据");
});
```
### 3 上层应用api接口(注意：记录仪只支持一个接口调用结束后再调用下一个接口)

#### 3.1 通用api接口,传入16进制指令返回的16进制数据

    api.execute(peripheral, command, onSuccess, onProgress);

** 参数 **

| 名称  | 类型  | 必需   | 说明 |
| ---- | ----- | ----- | ---- |
| peripheral | object | 是 | 设备的peripheral对象，由sys.connect成功回调函数中传回 |
| command | string | 是 | 多协通信协议中16进制指令 |
| isNeedResponse | boolean | 是 | 该command是否需要等待数据返回 |
| onSuccess | function | 是 | Success callback，回调参数为data，是16进制的数组 |
| onError | function | 是 | onError callback，回调参数为errorMsg |
| onProgress | function | 否 | 每次读一组数据后回调进度提示，回调参数为array ['已读数据量', '总数据量'] |

** 示例 **

```
dxsdk.api.execute(peripheral, "7F 00 05 F8", function(data){
  console.log(data);
  //data样例
  //["7F", "34", "05", "0B", "53", "4C", "30", "42", "36", "30", "30", "00", 
  "42", "57", "58", "30", "30", "30", "30", "32", "42", "57", "58", "30", "30", "30", "30", "32", "CD", "F4", "50", "86", "00", "01", "CA", "0F", "53", "4C", "30", "42", "36", "30", "30", "00","00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00"]
});
```
#### 3.2 获取记录仪状态

    api.status(peripheral, onSuccess, onProgress);

** 参数 **

| 名称  | 类型  | 必需   | 说明 |
| ---- | ----- | ----- | ---- |
| peripheral | object | 是 | 设备的peripheral对象，由sys.connect成功回调函数中传回 |
| onSuccess | function | 是 | Success callback，回调参数为json对象，看示例 |
| onError | function | 是 | 参见3.1的onError |
| onProgress | function | 否 | 参见3.1的onProgress |

** 示例 **

```
dxsdk.api.status(peripheral, function(json){
    alert(JSON.stringify(json));
});
```
** 返回值 **

| 名称  | 类型  | 说明 |
| ---- | ----- | ---- |
| module | string | SLUAN型号，如SL0B801 |
| id | string | 设备ID |
| key | string | 设备KEY |
| time | string | 设备时间，返回时间戳 |
| ver | string | 软件版本，如v1.0 |
| voltage | string | 设备当前电压,单位mV |
| name | string | 设备名 |
