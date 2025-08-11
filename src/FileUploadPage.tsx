import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import './FileUploadPage.css';

interface FileUploadPageProps {
  onFileUpload: (data: any, fileName: string, dataType: 'SHEIN' | 'TEMU') => void;
  onNavigateToDashboard: () => void;
}

const FileUploadPage: React.FC<FileUploadPageProps> = ({ onFileUpload, onNavigateToDashboard }) => {
  const [sheinFile, setSheinFile] = useState<string>('');
  const [temuFile, setTemuFile] = useState<string>('');
  const sheinInputRef = useRef<HTMLInputElement>(null);
  const temuInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'SHEIN' | 'TEMU') => {
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
        
        // Convert to array format
        let jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          raw: true,
          dateNF: 'yyyy-mm-dd hh:mm:ss'
        });
        
        // If it's TEMU data, insert empty column G (index 6)
        if (type === 'TEMU') {
          jsonData = jsonData.map((row: any) => {
            if (Array.isArray(row)) {
              // Insert empty value at index 6 (column G)
              const newRow = [...row];
              newRow.splice(6, 0, ''); // Insert empty string at position 6
              return newRow;
            }
            return row;
          });
        }
        
        // Store the processed data
        onFileUpload(jsonData, file.name, type);
        
        if (type === 'SHEIN') {
          setSheinFile(file.name);
        } else {
          setTemuFile(file.name);
        }
        
        alert(`${type} file uploaded successfully: ${file.name}`);
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        alert('Error parsing Excel file. Please check the file format.');
      }
    };
    
    reader.readAsBinaryString(file);
  };

  const canNavigate = sheinFile || temuFile;

  return (
    <div className="file-upload-page">
      <div className="upload-container">
        <h1 className="page-title">KPI Dashboard - Data Upload</h1>
        <p className="page-subtitle">Please upload your data files to proceed to the dashboard</p>
        
        <div className="upload-cards">
          {/* SHEIN Upload Card */}
          <div className="upload-card shein-card">
            <div className="card-header shein-header">
              <h2>SHEIN Data</h2>
            </div>
            <div className="card-body">
              <input
                ref={sheinInputRef}
                type="file"
                accept=".xlsx"
                onChange={(e) => handleFileUpload(e, 'SHEIN')}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => sheinInputRef.current?.click()}
                className="upload-button shein-button"
              >
                📤 Upload SHEIN Excel
              </button>
              {sheinFile && (
                <div className="file-status success">
                  ✅ {sheinFile}
                </div>
              )}
              <p className="upload-hint">
                Upload SHEIN shipment data in Excel format (.xlsx)<br/>
                
              </p>
            </div>
          </div>

          {/* TEMU Upload Card */}
          <div className="upload-card temu-card">
            <div className="card-header temu-header">
              <h2>TEMU Data</h2>
            </div>
            <div className="card-body">
              <input
                ref={temuInputRef}
                type="file"
                accept=".xlsx"
                onChange={(e) => handleFileUpload(e, 'TEMU')}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => temuInputRef.current?.click()}
                className="upload-button temu-button"
              >
                📤 Upload TEMU Excel
              </button>
              {temuFile && (
                <div className="file-status success">
                  ✅ {temuFile}
                </div>
              )}
              <p className="upload-hint">
                Upload TEMU shipment data in Excel format (.xlsx)<br/>

              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onNavigateToDashboard}
          disabled={!canNavigate}
          className={`go-dashboard-button ${canNavigate ? 'active' : 'disabled'}`}
        >
          Go to Dashboard →
        </button>

        {!canNavigate && (
          <p className="upload-reminder">
            Please upload at least one file (SHEIN or TEMU) to proceed
          </p>
        )}
      </div>
    </div>
  );
};

export default FileUploadPage;