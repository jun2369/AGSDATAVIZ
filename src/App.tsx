import React, { useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import * as XLSX from 'xlsx';
import DriverKPI from './DriverKPI';
import WarehouseKPI from './WarehouseKPI';
import DeliveryKPI from './DeliveryKPI';
import MissingData from './MissingData';
import './App.css';

// 定义数据类型
interface ExcelRow {
  port: string;
  mawbNumber: string;
  ataDate: Date | null;
  arrivedAtWarehouse: Date | null;
  timeDiff: number | null;
  timeCategory: string;
}

interface ProcessedData {
  lessThan12: ExcelRow[];
  between12And24: ExcelRow[];
  between24And48: ExcelRow[];
  between48And72: ExcelRow[];
  moreThan72: ExcelRow[];
}

const App: React.FC = () => {
  const [uploadedFile, setUploadedFile] = useState<string>('');
  const [uploadedData, setUploadedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel日期转换函数
  const excelDateToJSDate = (excelDate: number): Date | null => {
    if (!excelDate || typeof excelDate !== 'number') return null;
    // Excel dates start from 1900-01-01
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  };

  // 处理Excel数据
  const processExcelData = (data: any[]): ProcessedData => {
    const processed: ProcessedData = {
      lessThan12: [],
      between12And24: [],
      between24And48: [],
      between48And72: [],
      moreThan72: []
    };

    // 从第3行开始（索引2）
    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      
      // 获取列数据 (注意：XLSX使用0索引，所以B列是索引1，C列是索引2，F列是索引5，I列是索引8)
      const port = row[1] || ''; // B列 - Port
      const mawbNumber = row[2] || ''; // C列 - MAWB Number
      const ataDate = excelDateToJSDate(row[5]); // F列 - ATA Date
      const arrivedAtWarehouse = excelDateToJSDate(row[8]); // I列 - Arrived at Warehouse
      
      // 如果两个日期都存在，计算时间差
      if (ataDate && arrivedAtWarehouse) {
        const timeDiffMs = arrivedAtWarehouse.getTime() - ataDate.getTime();
        const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
        
        const rowData: ExcelRow = {
          port,
          mawbNumber,
          ataDate,
          arrivedAtWarehouse,
          timeDiff: timeDiffHours,
          timeCategory: ''
        };

        // 分类
        if (timeDiffHours < 12) {
          rowData.timeCategory = 'lessThan12';
          processed.lessThan12.push(rowData);
        } else if (timeDiffHours >= 12 && timeDiffHours < 24) {
          rowData.timeCategory = 'between12And24';
          processed.between12And24.push(rowData);
        } else if (timeDiffHours >= 24 && timeDiffHours < 48) {
          rowData.timeCategory = 'between24And48';
          processed.between24And48.push(rowData);
        } else if (timeDiffHours >= 48 && timeDiffHours < 72) {
          rowData.timeCategory = 'between48And72';
          processed.between48And72.push(rowData);
        } else {
          rowData.timeCategory = 'moreThan72';
          processed.moreThan72.push(rowData);
        }
      }
    }

    return processed;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      alert('Please upload only .xlsx files');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { 
          type: 'binary',
          cellDates: true,
          dateNF: 'yyyy-mm-dd hh:mm:ss'
        });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 转换为数组格式
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          raw: true,
          dateNF: 'yyyy-mm-dd hh:mm:ss'
        });
        
        console.log('Parsed data:', jsonData.slice(0, 5)); // 调试：查看前5行
        
        // 设置上传的数据，让各个组件自己处理
        setUploadedData({
          fileName: file.name,
          data: jsonData,
          uploadTime: new Date()
        });
        setUploadedFile(file.name);
        
        alert(`File uploaded successfully: ${file.name}`);
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        alert('Error parsing Excel file. Please check the file format.');
      }
    };
    
    reader.readAsBinaryString(file);
  };

  return (
    <Router>
      <div style={{ display: 'flex', height: '100vh', background: '#f5f5f5' }}>
        {/* Sidebar */}
        <aside style={{ 
          width: '260px', 
          background: 'white', 
          boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: '20px', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            position: 'relative'
          }}>
            <h2 style={{ margin: 0, display: 'inline-block' }}>KPI Dashboard</h2>
            <div className="warning-icon-container">
              <span className="warning-icon">⚠️</span>
              <div className="warning-tooltip">
                <strong>Please note the following:</strong>
                <ol>
                  <li>All date and time are in <strong>UTC standard time</strong>, not local time.</li>
                  <li>Shipment data only includes records with a <strong>creation date after July 1, 2025</strong>.</li>
                  <li>The data is <strong>not auto-synced</strong> and reflects <strong>only the content of the uploaded file</strong>.</li>
                </ol>
              </div>
            </div>
          </div>
          
          {/* Upload Section */}
          <div style={{ padding: '15px', background: '#f8f9fa' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                padding: '10px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              📤 Upload Excel
            </button>
            {uploadedFile && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#28a745' }}>
                ✅ {uploadedFile}
              </div>
            )}
          </div>
          
          {/* Navigation */}
          <nav style={{ flex: 1, padding: '20px' }}>
            <NavLink 
              to="/driver-kpi" 
              style={({ isActive }) => ({
                display: 'block',
                padding: '12px',
                marginBottom: '5px',
                textDecoration: 'none',
                borderRadius: '5px',
                color: isActive ? 'white' : '#333',
                background: isActive ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent'
              })}
            >
              🚗 Driver KPI
            </NavLink>
            <NavLink 
              to="/warehouse-kpi"
              style={({ isActive }) => ({
                display: 'block',
                padding: '12px',
                marginBottom: '5px',
                textDecoration: 'none',
                borderRadius: '5px',
                color: isActive ? 'white' : '#333',
                background: isActive ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent'
              })}
            >
              🏭 Warehouse KPI
            </NavLink>
            <NavLink 
              to="/delivery-kpi"
              style={({ isActive }) => ({
                display: 'block',
                padding: '12px',
                marginBottom: '5px',
                textDecoration: 'none',
                borderRadius: '5px',
                color: isActive ? 'white' : '#333',
                background: isActive ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent'
              })}
            >
              📦 Delivery KPI
            </NavLink>
            <NavLink 
              to="/missing-data"
              style={({ isActive }) => ({
                display: 'block',
                padding: '12px',
                marginBottom: '5px',
                textDecoration: 'none',
                borderRadius: '5px',
                color: isActive ? 'white' : '#333',
                background: isActive ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent'
              })}
            >
              ⚠️ Missing Data
            </NavLink>
          </nav>
        </aside>
        
        {/* Main Content */}
        <main style={{ flex: 1, padding: '30px', overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<DriverKPI uploadedData={uploadedData} />} />
            <Route path="/driver-kpi" element={<DriverKPI uploadedData={uploadedData} />} />
            <Route path="/warehouse-kpi" element={<WarehouseKPI uploadedData={uploadedData} />} />
            <Route path="/delivery-kpi" element={<DeliveryKPI uploadedData={uploadedData} />} />
            <Route path="/missing-data" element={<MissingData uploadedData={uploadedData} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;