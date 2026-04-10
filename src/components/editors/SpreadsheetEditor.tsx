import { useState, useEffect, useRef } from "react";

interface SpreadsheetEditorProps {
  content?: any;
  onChange: (content: any) => void;
}

interface Cell {
  row: number;
  col: number;
  value: string;
}

export default function SpreadsheetEditor({ content, onChange }: SpreadsheetEditorProps) {
  const [rows, setRows] = useState<Cell[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [cols, setCols] = useState(10);
  const [rowCount, setRowCount] = useState(20);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initializeGrid();
  }, []);

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

  const handleCellChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };

  const handleCellBlur = () => {
    if (selectedCell) {
      const newRows = [...rows];
      newRows[selectedCell.row][selectedCell.col].value = editValue;
      setRows(newRows);
      onChange(newRows);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && selectedCell) {
      handleCellBlur();
      if (selectedCell.row < rowCount - 1) {
        setSelectedCell({ row: selectedCell.row + 1, col: selectedCell.col });
        setEditValue(rows[selectedCell.row + 1][selectedCell.col].value);
      }
    }
    if (e.key === "Tab" && selectedCell) {
      e.preventDefault();
      handleCellBlur();
      if (selectedCell.col < cols - 1) {
        setSelectedCell({ row: selectedCell.row, col: selectedCell.col + 1 });
        setEditValue(rows[selectedCell.row][selectedCell.col + 1].value);
      }
    }
  };

  const addRow = () => {
    const newRow: Cell[] = [];
    for (let j = 0; j < cols; j++) {
      newRow.push({ row: rows.length, col: j, value: "" });
    }
    setRows([...rows, newRow]);
    setRowCount(rowCount + 1);
  };

  const addColumn = () => {
    const newRows = rows.map((row, i) => {
      return [...row, { row: i, col: row.length, value: "" }];
    });
    setRows(newRows);
    setCols(cols + 1);
  };

  return (
    <div className="spreadsheet-editor">
      <div className="spreadsheet-toolbar">
        <button className="spreadsheet-btn" onClick={addRow}>+ 添加行</button>
        <button className="spreadsheet-btn" onClick={addColumn}>+ 添加列</button>
        <span className="cell-info">
          {selectedCell && `当前: ${getColumnLabel(selectedCell.col)}${selectedCell.row + 1}`}
        </span>
      </div>

      <div className="spreadsheet-container">
        <table className="spreadsheet-table">
          <thead>
            <tr>
              <th className="row-header"></th>
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} className="col-header">{getColumnLabel(i)}</th>
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
                    className={`cell ${selectedCell?.row === rowIndex && selectedCell?.col === colIndex ? "selected" : ""}`}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                  >
                    {selectedCell?.row === rowIndex && selectedCell?.col === colIndex ? (
                      <input
                        ref={inputRef}
                        type="text"
                        className="cell-input"
                        value={editValue}
                        onChange={handleCellChange}
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
