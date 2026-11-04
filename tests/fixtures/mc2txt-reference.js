/* User-provided MC2TXT reference, by JiangQiYan713. Used only as a conversion test oracle. */

    // 全局变量存储转换结果
    let globalNormalLines = null;
    let globalEffectLines = null;
    let globalFileName = "";

    // 工具函数：将 beat 数组转换为浮点数（如 [1,0,4] 转换为 1.0，[2,2,4] 为 2.5）
    function beatArrayToFloat(arr) {
      return arr[0] + arr[1] / arr[2];
    }

    // 根据 time 列表，将任意 beat 转换到基准 BPM 下的等效节拍
    // 假设 timeList 按 beat 升序排列，且第一个 beat 应该为 [0,0,1]
    function convertBeat(beatVal, timeList, baseBPM) {
      let converted = 0;
      for (let i = 0; i < timeList.length; i++) {
        let segStart = beatArrayToFloat(timeList[i].beat);
        let segBPM = timeList[i].bpm;
        let segEnd = (i < timeList.length - 1) ? beatArrayToFloat(timeList[i+1].beat) : Infinity;
        if (beatVal >= segEnd) {
          let segLength = segEnd - segStart;
          converted += segLength * (baseBPM / segBPM);
        } else {
          let segLength = beatVal - segStart;
          converted += segLength * (baseBPM / segBPM);
          break;
        }
      }
      return converted;
    }

    // 生成 BPM 变化区间表格
    function generateTimeTable(timeList) {
      let html = '<table><tr><th>段序号</th><th>起始 Beat</th><th>BPM</th></tr>';
      for (let i = 0; i < timeList.length; i++) {
        let beatVal = beatArrayToFloat(timeList[i].beat);
        html += `<tr><td>${i}</td><td>${beatVal.toFixed(2)}</td><td>${timeList[i].bpm}</td></tr>`;
      }
      html += '</table>';
      return html;
    }
    
    // 合并同类项函数，对于 normalLines
    // 只有当相同的 beat（或 beat区间）完全一致时合并，合并后轨道数字按从大到小排列后前置
    function mergeLines(lines) {
      const groups = {};
      lines.forEach(line => {
        let parts = line.split("-");
        let key;
        if (parts.length === 2) {
          key = parts[1];  // 单点音符
        } else if (parts.length === 3) {
          key = parts[1] + "-" + parts[2]; // 长条音符
        }
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(parseInt(parts[0]));
      });
      const merged = [];
      for (let key in groups) {
        let cols = groups[key];
        // 排序降序
        cols.sort((a, b) => b - a);
        let mergedCol = cols.join("");
        merged.push(mergedCol + "-" + key);
      }
      return merged;
    }

    // 更新文本框显示内容，根据复选框状态决定是否合并
    function updateOutputDisplay() {
      if (!globalNormalLines) return;
      const mergeChecked = document.getElementById("mergeCheckbox").checked;
      let displayLines = [];
      if (mergeChecked) {
        displayLines = mergeLines(globalNormalLines);
      } else {
        displayLines = globalNormalLines;
      }
      document.getElementById("output").value = displayLines.join("\n");
    }

    // 读取并解析文件，执行转换（仅转换，不下载）
    document.getElementById("convertBtn").addEventListener("click", function() {
      const fileInput = document.getElementById("fileInput");
      if (!fileInput.files.length) {
        alert("请先选择一个文件。");
        return;
      }
      const file = fileInput.files[0];
      globalFileName = file.name;  // 存储原文件名
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const jsonData = JSON.parse(e.target.result);
          const timeList = jsonData.time;
          if (!timeList || timeList.length === 0) {
            alert("未找到 time 列表！");
            return;
          }
          // 基准 BPM 使用 timeList[0]（其 beat 应为 [0,0,1]）
          const baseBPM = timeList[0].bpm;
          // 显示 BPM 变化区间
          document.getElementById("timeTable").innerHTML = generateTimeTable(timeList);

          // 查找 offset，通过递归搜索整个 JSON 对象，取第一个遇到的 offset
          let offset = null;
          function searchOffset(obj) {
            if (typeof obj === "object" && obj !== null) {
              for (let key in obj) {
                if (key === "offset" && typeof obj[key] === "number") {
                  offset = obj[key];
                  return;
                } else {
                  searchOffset(obj[key]);
                  if (offset !== null) return;
                }
              }
            }
          }
          searchOffset(jsonData);
          if (offset === null) {
            alert("未找到 offset！");
            return;
          }

          // 读取 note 列表
          const noteList = jsonData.note;
          if (!noteList || noteList.length === 0) {
            alert("未找到 note 列表！");
            return;
          }
          // 排除含有 sound 属性的条目（防止干扰转换）
          const filteredNotes = noteList.filter(note => !("sound" in note));

          // 取第一个 note 的 beat 作为基准
          const firstNoteBeat = beatArrayToFloat(filteredNotes[0].beat);
          const firstConverted = convertBeat(firstNoteBeat, timeList, baseBPM);
          // 起始时间计算：60/baseBPM * 第一个 note 的 beat - offset/1000
          const startTime = 60 / baseBPM * firstNoteBeat - offset / 1000;

          // 显示计算信息（基准 BPM 和起始时间加粗）
          document.getElementById("calcResult").innerHTML =
            `基准 BPM: <strong>${baseBPM}</strong>，<br>` +
            `offset: ${offset} ms，<br>` +
            `起始时间: <strong>${startTime.toFixed(4)}</strong> 秒。`;

          // 生成普通 note 的 TXT 行
          let txtLines = [];
          filteredNotes.forEach(note => {
            const col = note.column;  // 0-based，输出时用 (column+1)
            const colStr = (col + 1).toString();
            const noteStart = beatArrayToFloat(note.beat);
            const convStart = convertBeat(noteStart, timeList, baseBPM) - firstConverted;
            let line = "";
            if ("endbeat" in note) {
              const noteEnd = beatArrayToFloat(note.endbeat);
              const convEnd = convertBeat(noteEnd, timeList, baseBPM) - firstConverted;
              line = `${colStr}-${convStart.toFixed(2)}-${convEnd.toFixed(2)}`;
            } else {
              line = `${colStr}-${convStart.toFixed(2)}`;
            }
            txtLines.push(line);
          });
          globalNormalLines = txtLines; // 保存原始行数组

          // 更新输出文本框显示（根据当前复选框状态）
          updateOutputDisplay();

          // 生成 SV TXT 行（若 effect 数组不为空）
          let effectLines = [];
          if (jsonData.effect && Array.isArray(jsonData.effect) && jsonData.effect.length > 0) {
            jsonData.effect.forEach(eff => {
              if ("scroll" in eff) {
                const effBeat = beatArrayToFloat(eff.beat);
                const convEff = convertBeat(effBeat, timeList, baseBPM) - firstConverted;
                effectLines.push(`${convEff.toFixed(2)},${eff.scroll}`);
              }
            });
          }
          globalEffectLines = effectLines; // 保存 effect 行数组
          document.getElementById("outputSV").value = effectLines.join("\n");

          alert("转换完成，请点击下载按钮下载文件。");
        } catch (err) {
          alert("解析文件出错：" + err);
        }
      }
      reader.readAsText(file);
    });

    // 下载按钮事件
    document.getElementById("downloadBtn").addEventListener("click", function() {
      if (!globalNormalLines) {
        alert("请先进行转换！");
        return;
      }
      const mergeChecked = document.getElementById("mergeCheckbox").checked;
      let normalLinesToDownload = [];
      if (mergeChecked) {
        normalLinesToDownload = mergeLines(globalNormalLines);
      } else {
        normalLinesToDownload = globalNormalLines;
      }
      const normalOutput = normalLinesToDownload.join("\n");

      // 根据原文件名生成下载文件名
      let originalName = globalFileName;
      let nameWithoutExt = originalName.lastIndexOf('.') !== -1 ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;
      let downloadNameNormal = "converted-" + nameWithoutExt + ".txt";
      let downloadNameSV = "converted-sv-" + nameWithoutExt + ".txt";

      // 下载普通 TXT 文件
      const blobNormal = new Blob([normalOutput], { type: "text/plain" });
      const urlNormal = URL.createObjectURL(blobNormal);
      const aNormal = document.createElement("a");
      aNormal.href = urlNormal;
      aNormal.download = downloadNameNormal;
      aNormal.click();
      URL.revokeObjectURL(urlNormal);

      // 如果 effect 有数据，则下载 SV TXT 文件
      if (globalEffectLines && globalEffectLines.length > 0) {
        const effectOutput = globalEffectLines.join("\n");
        const blobSV = new Blob([effectOutput], { type: "text/plain" });
        const urlSV = URL.createObjectURL(blobSV);
        const aSV = document.createElement("a");
        aSV.href = urlSV;
        aSV.download = downloadNameSV;
        aSV.click();
        URL.revokeObjectURL(urlSV);
      }
    });

    // 当复选框状态变化时，更新文本框显示
    document.getElementById("mergeCheckbox").addEventListener("change", updateOutputDisplay);
  