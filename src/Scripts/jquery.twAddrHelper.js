/*
台灣地址輸入輔助元件 by Jeffrey Lee
http://blog.darkthread.net

Ver 1.0 2013-05-21 初版
*/

(function ($) {
    $.fn.caret = function (pos, end) {
        var target = this[0];
        if (arguments.length == 0) { //get
            if (target.selectionStart) { //DOM
                var pos = target.selectionStart;
                return pos > 0 ? pos : 0;
            }
            else if (target.createTextRange) { //IE
                target.focus();
                var range = document.selection.createRange();
                if (range == null)
                    return '0';
                var re = target.createTextRange();
                var rc = re.duplicate();
                re.moveToBookmark(range.getBookmark());
                rc.setEndPoint('EndToStart', re);
                return rc.text.length;
            }
            else return 0;
        } //set
        //2010-05-28 by Jeffrey, "end"
        if (pos == "end") pos = target.value.length;
        if (end == "end") end = target.value.length;
        if (end == undefined) end = pos;
        if (target.setSelectionRange) //DOM
            target.setSelectionRange(pos, end);
        else if (target.createTextRange) { //IE
            var range = target.createTextRange();
            range.collapse(true);
            range.moveEnd('character', end);
            range.moveStart('character', pos);
            range.select();
        }
    }
})(jQuery);

(function ($) {
	//指定ZIP資料版號，ZIP換版時修改本參數，可強迫讀取新版本
    var requiredZip3Version = "20130406";
    var badJsonStringify = JSON.stringify("中").length > 3;
    function InitData() {
        if ($.blockUI) $.blockUI({ message: "地址資料準備中..." });
        //因地址資料龐大(1MB)，首次AJAX載入後存入localStorage，提升效率
        if (localStorage && localStorage.twAddrData != undefined)
            $.twAddrData = JSON.parse(localStorage.twAddrData) || null;
		//若localStorage資料版號不同，清除清料以觸發重新下載
        if ($.twAddrData && $.twAddrData.Version != requiredZip3Version) {
            $.twAddrData = undefined;
        }
		//若已有資料，結束作業不執行AJAX下載
        if ($.twAddrData) {
            if ($.unblockUI) $.unblockUI();
            return;
        }
        $.getJSON("Scripts/zip3.js", function (r) {
            var zipDataPack = {};
            //郵遞區號與縣市區域對照表
            zipDataPack.zip2Area = r["Zip2Area"];
            zipDataPack.area2Zip = r["Area2Zip"];
            //完整到路段之資料
            zipDataPack.data = r["Data"];
            //建立縣市路名索引
            var roadHints = {};
            var sortedAddrs = [];
            for (var zip in zipDataPack.data) {
                var zipData = zipDataPack.data[zip];
                for (var city in zipData) {
                    var cityData = zipData[city];
                    for (var area in cityData) {
                        var roadArray = cityData[area];
                        for (var i = 0; i < roadArray.length; i++) {
                            var addr = city + area + roadArray[i];
                            roadHints[addr] = zip;
                            sortedAddrs.push(addr);
                        }
                    }
                }
            }
            zipDataPack.roadHints = roadHints;
            zipDataPack.sortedAddrs = sortedAddrs.sort();
            $.twAddrData = zipDataPack;
            if (localStorage) {
				//REF: http://blog.darkthread.net/post-2013-04-10-ie8-json-stringify-ucn-encoding.aspx
                //IE8 JSON.stringify("中")會得到"\u4e2d", 長度爆增無法存入localStorage
                //改用JSON2.js提供的stringify (需載入json2ext.js以宣告JSON2物件)
                if (badJsonStringify) {
                    if (JSON2) 
                        localStorage.twAddrData = JSON2.stringify(zipDataPack);
                }
                else
                    localStorage.twAddrData = JSON.stringify(zipDataPack);
            }
            if ($.unblockUI) $.unblockUI();
        });
    }
    InitData();
	function noData() { 
		if (!$.twAddrData || !$.twAddrData.zipData) {
			alert("郵遞區號資料未載入!");
			return true;
		}
		return false; 
	}
			
    //以關鍵字查詢郵遞區號
    $.QueryZip = function (t) {
        var r = [];
		if (noData()) return r;
        for (var zip in $.twAddrData.zipData) {
            if (zip.indexOf(t) == 0) {
                r.push(zip);
                if (r.length >= 10)
                    break;
            }
        }
        return r;
    };
    //查詢特定郵遞區號之縣市區域清單
    $.QueryAreaByZip = function (t) {
		if (noData()) return [];
        return $.twAddrData.zip2Area[t];
    };
    //由路名查詢郵遞區號
    $.QueryZipByRoad = function (t) {
		if (noData()) return "";
        for (var a in $.twAddrData.area2Zip) {
            if (t.indexOf(a) > -1) {
                //因同一區可能有兩種不同的郵遞區號，在此要進一步比對
                //若同一條路有兩種郵遞區號，則取第1筆(EX: 台南市新市區大社->741, 744)
                var roadHints = $.twAddrData.roadHints;
                for (var r in roadHints) {
                    if (r.indexOf(a) > -1)
                        return roadHints[r];
                }
                return area2Zip[a];
            }
        }
    };
    //由地址查詢吻合的路名
    $.QueryAddress = function (t) {
		if (noData()) return "";
        var r = [];
        var regExMode = (t.indexOf("*") > -1);
        var re;
        if (regExMode) re = new RegExp(t.replace(/\*/g, ".*"));
        for (var i = 0; i < $.twAddrData.sortedAddrs.length; i++) {
            var s = $.twAddrData.sortedAddrs[i];
            var test =
                regExMode ? re.test(s) : s.indexOf(t) == 0;
            if (test) {
                r.push(s);
                if (r.length >= 10) break;
            }
        }
        return r;
    };
})(jQuery);


function findValue(li) {
    return;
}

//設定地址輸入輔助
function setAddressInput($container) {
    function getDefaultOpt() {
        var opt =
        {
            delay: 10,
            width: 250,
            minChars: 1, //至少輸入幾個字元才開始給提示?
            matchSubset: false,
            matchContains: false,
            cacheLength: 0,
            noCache: true, //黑暗版自訂參數，每次都重新連後端查詢(適用總資料筆數很多時)
            onItemSelect: false,
            onFindValue: findValue,
            formatItem: function (row) {
                return "<div style='height:12px; color:blue;'><div style='float:left'>" + row[0] + "</div>";
            },
            autoFill: false,
            mustMatch: false //是否允許輸入提示清單上沒有的值?
        };
        return opt;
    }
    var $inpCountry = $container.find("input.cCountry:first");
    var $inpZip = $container.find("input.cZip:first");
    var $inpAddress = $container.find("input.cAddress:first");

    //選項說明: http://docs.jquery.com/Plugins/Autocomplete/autocomplete#url_or_dataoptions
    var opt1 = $.extend(getDefaultOpt(),
    {
        width: 400,
        onItemSelect: function (li) {
            if (li != null) {
                var hint = $(li).text();
                if (hint.indexOf("(") > 0) {
                    var p = hint.split("(");
                    $inpAddress.val(p[0]).prev().val(p[1].substr(0, 3));
                }

                $inpAddress.focus().caret("end");
            }
        }
    });
    $inpAddress
    .blur(function () {
        //非台灣時停用
        if ($inpCountry.val() != "TW") return;
        $inpZip.val($.QueryZipByRoad(this.value));
    })
    .autocomplete(
    function (t) {

        //非台灣時停用
        if ($inpCountry.val() != "TW") return [];

        var lst = $.QueryAddress(t);
        var result = [];
        for (var i = 0; i < lst.length; i++)
            result.push([lst[i]]);
        return result;
    }, opt1);

    function zipToArea(t) {
        $inpAddress
        .val($.QueryAreaByZip(t))
        .focus().caret("end");
    }
    var opt2 = $.extend(getDefaultOpt(),
    {
        width: 35,
        onItemSelect: function (li) {
            if (li != null)
                zipToArea(li.selectValue);
        }
    });

    $inpZip
    .change(function () {

        //非台灣時停用
        if ($inpCountry.val() != "TW") return;

        var v = $(this).val();
        //改為地址欄長度如為6個字(含)以下，帶入縣市區域
        if (v.length == 3 && $(this).next().val().length <= 6)
            zipToArea(v);
    })
    .autocomplete(
    function (t) {

        //非台灣時停用
        if ($inpCountry.val() != "TW") return [];

        var lst = $.QueryZip(t);
        var result = [];
        for (var i = 0; i < lst.length; i++)
            result.push([lst[i]]);
        //只有一個結果時，強制送出
        if (result.length == 1) {
            zipToArea(result[0][0]);
            return [];
        }
        else
            return result;
    }, opt2);
}