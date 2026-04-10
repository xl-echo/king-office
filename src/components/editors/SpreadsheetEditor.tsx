import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import * as XLSX from "xlsx";

export interface Cell {
  row: number;
  col: number;
  value: string;
}

export interface SpreadsheetEditorHandle {
  getXlsxBuffer: () => Uint8Array;
  getCsvBuffer: () => Uint8Array;
  loadXlsx: (buffer: Uint8Array) => void;
  addRow: () => void;
  addColumn: () => void;
}

interface SpreadsheetEditorProps {
  content?: any;
  onChange: (content: any) => void;
}

export default forwardRef<SpreadsheetEditorHandle, SpreadsheetEditorProps>(
  function SpreadsheetEditor({ content, onChange }, ref) {
    const [rows, setRows] = useState<Cell[][]>([]);
    const [selectedCell, setSelectedCell] = useState<{
      row: number;
      col: number;
    } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [cols, setCols] = useState(10);
    const [rowCount, setRowCount] = useState(20);
    const inputRef = useRef<HTMLInputElement>(null);

    const initializeGrid = () => {
      const grid: Cell[][] = [];
      for (let i = 0; i < rowCount; i++) {
        const row: Cell[] = [];
        for (let j = 0; j < cols; j++) {
          row.push({ row: i, col: j, value: "" });
        }
        grid.push(row);
      }
      setRows(grid);
    };

    useEffect(() => {
      if (content) {
        if (content instanceof Uint8Array) {
          loadXlsxFromBuffer(content);
        } else if (Array.isArray(content)) {
          setRows(content);
          if (content.length > 0) setRowCount(content.length);
          if (content[0]?.length) setCols(content[0].length);
        }
      } else {
        // 新建文件时初始化空白网格
        initializeGrid();
        // 通知父组件已创建新文件
        setTimeout(() => onChange([]), 0);
      }
    }, [content]);

    const loadXlsxFromBuffer = (buffer: Uint8Array) => {
      try {
        const wb = XLSX.read(buffer, { type: "array" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
        const maxRows = Math.max(data.length, 20);
        const maxCols = Math.max(
          ...(data.map((r: any) => (Array.isArray(r) ? r.length : 1)).length
            ? data.map((r: any) => (Array.isArray(r) ? r.length : 1))
            : [10])
        );
        const actualCols = Math.max(maxCols, 10);
        const grid: Cell[][] = [];
        for (let i = 0; i < maxRows; i++) {
          const row: Cell[] = [];
          for (let j = 0; j < actualCols; j++) {
            row.push({
              row: i,
              col: j,
              value: data[i]?.[j] != null ? String(data[i][j]) : "",
            });
          }
          grid.push(row);
        }
        setRows(grid);
        setRowCount(maxRows);
        setCols(actualCols);
      } catch (err) {
        console.error("[SpreadsheetEditor] xlsx parse failed:", err);
        initializeGrid();
      }
    };

    useImperativeHandle(ref, () => ({
      getXlsxBuffer: () => generateXlsx(),
      getCsvBuffer: () => generateCsv(),
      loadXlsx: (buffer: Uint8Array) => loadXlsxFromBuffer(buffer),
      addRow: () => handleAddRow(),
      addColumn: () => handleAddColumn(),
    }));

    const getColumnLabel = (col: number): string => {
      let label = "";
      let n = col;
      while (n >= 0) {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
      }
      return label;
    };

    const handleCellClick = (row: number, col: number) => {
      setSelectedCell({ row, col });
      setEditValue(rows[row][col].value);
      inputRef.current?.focus();
    };

    const handleCellBlur = () => {
      if (selectedCell) {
        const newRows = rows.map((r) => r.map((c) => ({ ...c })));
        newRows[selectedCell.row][selectedCell.col].value = editValue;
        setRows(newRows);
        onChange(newRows);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && selectedCell) {
        e.preventDefault();
        handleCellBlur();
        if (selectedCell.row < rowCount - 1) {
          const nextRow = selectedCell.row + 1;
          setSelectedCell({ row: nextRow, col: selectedCell.col });
          setEditValue(rows[nextRow][selectedCell.col].value);
        }
      }
      if (e.key === "Tab" && selectedCell) {
        e.preventDefault();
        handleCellBlur();
        if (selectedCell.col < cols - 1) {
          const nextCol = selectedCell.col + 1;
          setSelectedCell({ row: selectedCell.row, col: nextCol });
          setEditValue(rows[selectedCell.row][nextCol].value);
        }
      }
    };

    const handleAddRow = () => {
      const newRow: Cell[] = [];
      for (let j = 0; j < cols; j++) {
        newRow.push({ row: rows.length, col: j, value: "" });
      }
      const newRows = [...rows, newRow];
      setRows(newRows);
      setRowCount(rows.length + 1);
      onChange(newRows);
    };

    const handleAddColumn = () => {
      const newRows = rows.map((row, i) => [
        ...row,
        { row: i, col: row.length, value: "" },
      ]);
      setRows(newRows);
      setCols(cols + 1);
      onChange(newRows);
    };

    const generateXlsx = (): Uint8Array => {
      const data = rows.map((row) => row.map((cell) => cell.value));
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      return new Uint8Array(buf);
    };

    const generateCsv = (): Uint8Array => {
      const data = rows.map((row) => row.map((cell) => {
        // 处理单元格值中的特殊字符
        let value = cell.value || "";
        // 如果包含逗号、引号或换行符，需要用引号包裹
        if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
          value = "\"" + value.replace(/\"/g, "\"\"") + "\"";
        }
        return value;
      }));
      const csvContent = data.map(row => row.join(",")).join("\n");
      // 添加UTF-8 BOM以支持Excel正确打开
      const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const content = new TextEncoder().encode(csvContent);
      return new Uint8Array([...BOM, ...content]);
    };

    return (
      <div className="spreadsheet-editor">
        <div className="spreadsheet-toolbar">
          <button className="spreadsheet-btn" onClick={handleAddRow}>
            + 添加行
          </button>
          <button className="spreadsheet-btn" onClick={handleAddColumn}>
            + 添加列
          </button>
          <span className="cell-info">
            {selectedCell &&
              `当前: ${getColumnLabel(selectedCell.col)}${selectedCell.row + 1}`}
          </span>
        </div>
        <div className="spreadsheet-container">
          <table className="spreadsheet-table">
            <thead>
              <tr>
                <th className="row-header"></th>
                {Array.from({ length: cols }, (_, i) => (
                  <th key={i} className="col-header">
                    {getColumnLabel(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="row-header">{rowIndex + 1}</td>
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className={`cell ${
                        selectedCell?.row === rowIndex &&
                        selectedCell?.col === colIndex
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                    >
                      {selectedCell?.row === rowIndex &&
                      selectedCell?.col === colIndex ? (
                        <input
                          ref={inputRef}
                          type="text"
                          className="cell-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                        />
                      ) : (
                        cell.value
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);
