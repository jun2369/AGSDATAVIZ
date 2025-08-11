import React, { useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import * as XLSX from 'xlsx';
import FileUploadPage from './FileUploadPage';
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

interface UploadedDataSet {
  fileName: string;
  data: any;
  uploadTime: Date;
  dataType: 'SHEIN' | 'TEMU';
}

const App: React.FC = () => {
  const [showDashboard, setShowDashboard] = useState<boolean>(false);
  const [sheinData, setSheinData] = useState<UploadedDataSet | null>(null);
  const [temuData, setTemuData] = useState<UploadedDataSet | null>(null);
  const [currentDataType, setCurrentDataType] = useState<'SHEIN' | 'TEMU'>('SHEIN');
  const [uploadedFile, setUploadedFile] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current data based on selected type
  const getCurrentData = () => {
    if (currentDataType === 'SHEIN') {
      return sheinData;
    } else {
      return temuData;
    }
  };

  // Handle file upload from FileUploadPage
  const handleInitialFileUpload = (data: any, fileName: string, dataType: 'SHEIN' | 'TEMU') => {
    const uploadedData: UploadedDataSet = {
      fileName,
      data,
      uploadTime: new Date(),
      dataType
    };

    if (dataType === 'SHEIN') {
      setSheinData(uploadedData);
    } else {
      setTemuData(uploadedData);
    }
  };

  // Navigate to dashboard
  const handleNavigateToDashboard = () => {
    // Set current data type based on what's available
    if (sheinData && !temuData) {
      setCurrentDataType('SHEIN');
      setUploadedFile(sheinData.fileName);
    } else if (temuData && !sheinData) {
      setCurrentDataType('TEMU');
      setUploadedFile(temuData.fileName);
    } else if (sheinData) {
      // Default to SHEIN if both are available
      setCurrentDataType('SHEIN');
      setUploadedFile(sheinData.fileName);
    }
    setShowDashboard(true);
  };

  // Handle switching between SHEIN and TEMU
  const handleDataTypeSwitch = (type: 'SHEIN' | 'TEMU') => {
    setCurrentDataType(type);
    const data = type === 'SHEIN' ? sheinData : temuData;
    if (data) {
      setUploadedFile(data.fileName);
    } else {
      setUploadedFile('');
    }
  };

  // Excel日期转换函数
  const excelDateToJSDate = (excelDate: number): Date | null => {
    if (!excelDate || typeof excelDate !== 'number') return null;
    // Excel dates start from 1900-01-01
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  };

  // Handle file upload from sidebar (in dashboard)
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
        let jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          raw: true,
          dateNF: 'yyyy-mm-dd hh:mm:ss'
        });
        
        // If current type is TEMU, insert empty column G
        if (currentDataType === 'TEMU') {
          jsonData = jsonData.map((row: any) => {
            if (Array.isArray(row)) {
              const newRow = [...row];
              newRow.splice(6, 0, ''); // Insert empty string at position 6
              return newRow;
            }
            return row;
          });
        }
        
        console.log('Parsed data:', jsonData.slice(0, 5)); // 调试：查看前5行
        
        // Update the data for current type
        const uploadedData: UploadedDataSet = {
          fileName: file.name,
          data: jsonData,
          uploadTime: new Date(),
          dataType: currentDataType
        };
        
        if (currentDataType === 'SHEIN') {
          setSheinData(uploadedData);
        } else {
          setTemuData(uploadedData);
        }
        
        setUploadedFile(file.name);
        alert(`${currentDataType} file uploaded successfully: ${file.name}`);
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        alert('Error parsing Excel file. Please check the file format.');
      }
    };
    
    reader.readAsBinaryString(file);
  };

  // If not showing dashboard, show upload page
  if (!showDashboard) {
    return (
      <FileUploadPage
        onFileUpload={handleInitialFileUpload}
        onNavigateToDashboard={handleNavigateToDashboard}
      />
    );
  }

  // Show dashboard
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
          
          {/* Data Type Selector */}
          <div style={{ padding: '15px', background: '#f0f2f5', borderBottom: '1px solid #dee2e6' }}>
            <div style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '14px', color: '#495057' }}>
              Select Data Source:
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleDataTypeSwitch('SHEIN')}
                disabled={!sheinData}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: currentDataType === 'SHEIN' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff',
                  color: currentDataType === 'SHEIN' ? 'white' : '#333',
                  border: currentDataType === 'SHEIN' ? 'none' : '1px solid #dee2e6',
                  borderRadius: '5px',
                  cursor: sheinData ? 'pointer' : 'not-allowed',
                  opacity: sheinData ? 1 : 0.5,
                  fontWeight: currentDataType === 'SHEIN' ? 'bold' : 'normal',
                  transition: 'all 0.3s ease'
                }}
              >
                SHEIN {!sheinData && '(No data)'}
              </button>
              <button
                onClick={() => handleDataTypeSwitch('TEMU')}
                disabled={!temuData}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: currentDataType === 'TEMU' ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : '#fff',
                  color: currentDataType === 'TEMU' ? 'white' : '#333',
                  border: currentDataType === 'TEMU' ? 'none' : '1px solid #dee2e6',
                  borderRadius: '5px',
                  cursor: temuData ? 'pointer' : 'not-allowed',
                  opacity: temuData ? 1 : 0.5,
                  fontWeight: currentDataType === 'TEMU' ? 'bold' : 'normal',
                  transition: 'all 0.3s ease'
                }}
              >
                TEMU {!temuData && '(No data)'}
              </button>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6c757d', textAlign: 'center' }}>
              Current: <strong>{currentDataType}</strong>
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
                background: currentDataType === 'TEMU' 
                  ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              📤 Upload {currentDataType} Excel
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
            <Route path="/" element={<DriverKPI uploadedData={getCurrentData()} />} />
            <Route path="/driver-kpi" element={<DriverKPI uploadedData={getCurrentData()} />} />
            <Route path="/warehouse-kpi" element={<WarehouseKPI uploadedData={getCurrentData()} />} />
            <Route path="/delivery-kpi" element={<DeliveryKPI uploadedData={getCurrentData()} />} />
            <Route path="/missing-data" element={<MissingData uploadedData={getCurrentData()} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;