import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import './AverageKPI.css';

interface AverageKPIProps {
  uploadedData?: any;
}

interface KPIRow {
  port: string;
  mawbNumber: string;
  ataDate: Date;
  targetDate: Date;
  kpiValue: number;
  kpiFormatted: string;
}

const AverageKPI: React.FC<AverageKPIProps> = ({ uploadedData }) => {
  const [selectedPOE, setSelectedPOE] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [availablePOEs, setAvailablePOEs] = useState<string[]>(['ALL']);
  const [availableCategories, setAvailableCategories] = useState<string[]>(['ALL']);
  const [fromDate, setFromDate] = useState<string>('2025-07-01');
  const [toDate, setToDate] = useState<string>('');
  const [selectedChartKPI, setSelectedChartKPI] = useState<string>('ATA to Released');
  const [chartViewType, setChartViewType] = useState<'overall' | 'standardization'>('overall');
  const [standardizationThreshold, setStandardizationThreshold] = useState<48 | 72>(48);
  const [standardizationSortOrder, setStandardizationSortOrder] = useState<'desc' | 'asc'>('desc');
  
  const [sortOrder1, setSortOrder1] = useState<'asc' | 'desc' | null>(null);
  const [sortOrder2, setSortOrder2] = useState<'asc' | 'desc' | null>(null);
  const [sortOrder3, setSortOrder3] = useState<'asc' | 'desc' | null>(null);
  const [sortOrder4, setSortOrder4] = useState<'asc' | 'desc' | null>(null);
  
  const parseExcelDate = (value: any): Date | null => {
    if (!value) return null;
    
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return isNaN(date.getTime()) ? null : date;
    }
    
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
  };

  const formatHours = (hours: number): string => {
    return `${hours.toFixed(2)}h`;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const calculateAverage = (kpiList: KPIRow[]): number => {
    if (kpiList.length === 0) return 0;
    const sum = kpiList.reduce((acc, row) => acc + row.kpiValue, 0);
    return sum / kpiList.length;
  };

  const calculateAverageByPOE = (kpiList: KPIRow[]): { poe: string; average: number; count: number }[] => {
    if (kpiList.length === 0) return [];
    
    const poeGroups = kpiList.reduce((acc, row) => {
      if (!acc[row.port]) {
        acc[row.port] = { sum: 0, count: 0 };
      }
      acc[row.port].sum += row.kpiValue;
      acc[row.port].count += 1;
      return acc;
    }, {} as Record<string, { sum: number; count: number }>);
    
    return Object.entries(poeGroups)
      .map(([poe, data]) => ({
        poe,
        average: data.sum / data.count,
        count: data.count
      }))
      .sort((a, b) => b.average - a.average);
  };

  useEffect(() => {
    if (!uploadedData || !uploadedData.data || !Array.isArray(uploadedData.data)) {
      return;
    }

    let data = uploadedData.data;
    const isTEMU = uploadedData.fileName && uploadedData.fileName.toLowerCase().includes('temu');
    
    if (isTEMU) {
      data = data.map((row: any) => {
        if (!row || !Array.isArray(row)) return row;
        const newRow = [...row];
        newRow.splice(6, 0, '');
        return newRow;
      });
    }
    
    const poesSet = new Set<string>(['ALL']);
    const categoriesSet = new Set<string>(['ALL']);
    let maxDate: Date | null = null;

    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) continue;

      const poe = String(row[1] || '').trim().toUpperCase();
      if (poe) {
        poesSet.add(poe);
      }

      const category = String(row[0] || '').trim().toUpperCase();
      if (category === 'T01' || category === 'T86') {
        categoriesSet.add(category);
      }
      
      const ataDate = parseExcelDate(row[5]);
      if (ataDate && ataDate >= new Date('2025-07-01')) {
        if (!maxDate || ataDate > maxDate) {
          maxDate = ataDate;
        }
      }
    }

    const poesList = Array.from(poesSet).sort();
    const orderedPOEs = ['ALL'];
    const specificPOEs = ['ORD', 'LAX', 'JFK', 'DFW', 'MIA', 'SFO'];
    specificPOEs.forEach(poe => {
      if (poesSet.has(poe)) {
        orderedPOEs.push(poe);
      }
    });
    poesList.forEach(poe => {
      if (!orderedPOEs.includes(poe)) {
        orderedPOEs.push(poe);
      }
    });
    
    setAvailablePOEs(orderedPOEs);
    setAvailableCategories(Array.from(categoriesSet).sort());
    
    if (maxDate && !toDate) {
      const year = maxDate.getFullYear();
      const month = String(maxDate.getMonth() + 1).padStart(2, '0');
      const day = String(maxDate.getDate()).padStart(2, '0');
      setToDate(`${year}-${month}-${day}`);
    } else if (!toDate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setToDate(`${year}-${month}-${day}`);
    }
  }, [uploadedData]);

  const calculateKPIs = useMemo(() => {
    if (!uploadedData || !uploadedData.data || !Array.isArray(uploadedData.data)) {
      return {
        ataToReleased: [],
        ataToConsigntoFinal: [],
        ataToHandover: [],
        ataToFinalReleased: []
      };
    }

    let data = uploadedData.data;
    const isTEMU = uploadedData.fileName && uploadedData.fileName.toLowerCase().includes('temu');
    
    if (isTEMU) {
      data = data.map((row: any) => {
        if (!row || !Array.isArray(row)) return row;
        const newRow = [...row];
        newRow.splice(6, 0, '');
        return newRow;
      });
    }

    const ataToReleasedList: KPIRow[] = [];
    const ataToConsigntoFinalList: KPIRow[] = [];
    const ataToHandoverList: KPIRow[] = [];
    const ataToFinalReleasedList: KPIRow[] = [];
    
    const fromDateFilter = fromDate ? new Date(fromDate + 'T00:00:00') : new Date('2025-07-01T00:00:00');
    const toDateFilter = toDate ? new Date(toDate + 'T23:59:59') : new Date('2099-12-31T23:59:59');

    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) continue;

      const ataDate = parseExcelDate(row[5]);
      
      if (!ataDate) {
        continue;
      }

      const ataYear = ataDate.getFullYear();
      const ataMonth = ataDate.getMonth();
      const ataDay = ataDate.getDate();
      
      const fromYear = fromDateFilter.getFullYear();
      const fromMonth = fromDateFilter.getMonth();
      const fromDay = fromDateFilter.getDate();
      
      const toYear = toDateFilter.getFullYear();
      const toMonth = toDateFilter.getMonth();
      const toDay = toDateFilter.getDate();
      
      const ataDateOnly = new Date(ataYear, ataMonth, ataDay);
      const fromDateOnly = new Date(fromYear, fromMonth, fromDay);
      const toDateOnly = new Date(toYear, toMonth, toDay);
      
      if (ataDateOnly < fromDateOnly || ataDateOnly > toDateOnly) {
        continue;
      }

      const category = String(row[0] || '').trim().toUpperCase();
      
      if (selectedCategory !== 'ALL' && category !== selectedCategory) {
        continue;
      }

      const port = String(row[1] || '').trim().toUpperCase();
      
      if (selectedPOE !== 'ALL' && port !== selectedPOE) continue;
      
      if (!port) continue;

      const mawbNumber = String(row[2] || '').trim();
      
      const releaseDate = parseExcelDate(row[isTEMU ? 11 : 10]);
      const ConsigntoFinalate = parseExcelDate(row[isTEMU ? 15 : 14]);
      const handoverTime = parseExcelDate(row[isTEMU ? 16 : 15]);
      const finalReleasedDate = parseExcelDate(row[isTEMU ? 14 : 13]);

      if (ataDate && releaseDate) {
        const diffHours = (releaseDate.getTime() - ataDate.getTime()) / (1000 * 60 * 60);
        ataToReleasedList.push({
          port,
          mawbNumber,
          ataDate,
          targetDate: releaseDate,
          kpiValue: diffHours,
          kpiFormatted: formatHours(diffHours)
        });
      }

      if (ataDate && ConsigntoFinalate) {
        const diffHours = (ConsigntoFinalate.getTime() - ataDate.getTime()) / (1000 * 60 * 60);
        ataToConsigntoFinalList.push({
          port,
          mawbNumber,
          ataDate,
          targetDate: ConsigntoFinalate,
          kpiValue: diffHours,
          kpiFormatted: formatHours(diffHours)
        });
      }

      if (ataDate && handoverTime) {
        const diffHours = (handoverTime.getTime() - ataDate.getTime()) / (1000 * 60 * 60);
        ataToHandoverList.push({
          port,
          mawbNumber,
          ataDate,
          targetDate: handoverTime,
          kpiValue: diffHours,
          kpiFormatted: formatHours(diffHours)
        });
      }

      if (ataDate && finalReleasedDate) {
        const diffHours = (finalReleasedDate.getTime() - ataDate.getTime()) / (1000 * 60 * 60);
        ataToFinalReleasedList.push({
          port,
          mawbNumber,
          ataDate,
          targetDate: finalReleasedDate,
          kpiValue: diffHours,
          kpiFormatted: formatHours(diffHours)
        });
      }
    }

    return {
      ataToReleased: ataToReleasedList,
      ataToConsigntoFinal: ataToConsigntoFinalList,
      ataToHandover: ataToHandoverList,
      ataToFinalReleased: ataToFinalReleasedList
    };
  }, [uploadedData, selectedPOE, selectedCategory, fromDate, toDate]);

  const getChartData = useMemo(() => {
    let dataToUse: KPIRow[] = [];
    
    switch(selectedChartKPI) {
      case 'ATA to Released':
        dataToUse = calculateKPIs.ataToReleased;
        break;
      case 'ATA to ConsigntoFM':
        dataToUse = calculateKPIs.ataToConsigntoFinal;
        break;
      case 'ATA to Handover':
        dataToUse = calculateKPIs.ataToHandover;
        break;
      case 'ATA to FinalReleased':
        dataToUse = calculateKPIs.ataToFinalReleased;
        break;
      default:
        dataToUse = calculateKPIs.ataToReleased;
    }
    
    if (chartViewType === 'overall') {
      const poeData = calculateAverageByPOE(dataToUse);
      
      return poeData.map(item => ({
        name: item.poe,
        value: parseFloat(item.average.toFixed(2)),
        count: item.count
      }));
    } else {
      // Standardization view - count MAWB with KPI < threshold by POE
      const poeGroups = dataToUse.reduce((acc, row) => {
        if (!acc[row.port]) {
          acc[row.port] = { underThreshold: 0, total: 0 };
        }
        acc[row.port].total += 1;
        if (row.kpiValue < standardizationThreshold) {
          acc[row.port].underThreshold += 1;
        }
        return acc;
      }, {} as Record<string, { underThreshold: number; total: number }>);
      
      const unsortedData = Object.entries(poeGroups)
        .map(([poe, data]) => ({
          name: poe,
          value: data.underThreshold,
          count: data.total,
          percentage: data.total > 0 ? (data.underThreshold / data.total) * 100 : 0
        }));
      
      // Sort by percentage based on sort order
      return unsortedData.sort((a, b) => {
        if (standardizationSortOrder === 'desc') {
          return b.percentage - a.percentage;
        } else {
          return a.percentage - b.percentage;
        }
      });
    }
  }, [calculateKPIs, selectedChartKPI, chartViewType, standardizationThreshold, standardizationSortOrder]);

  const sortData = (data: KPIRow[], order: 'asc' | 'desc' | null): KPIRow[] => {
    if (!order) return data;
    return [...data].sort((a, b) => {
      if (order === 'asc') {
        return a.kpiValue - b.kpiValue;
      } else {
        return b.kpiValue - a.kpiValue;
      }
    });
  };

  const exportToExcel = (data: KPIRow[], kpiType: string) => {
    const exportData = data.map(row => ({
      'POE': row.port,
      'MAWB Number': row.mawbNumber,
      [`${kpiType} (hours)`]: row.kpiValue.toFixed(2),
      [`${kpiType} (formatted)`]: row.kpiFormatted
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, kpiType);
    
    const filename = `${kpiType.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const exportKPISummary = (data: KPIRow[], kpiType: string) => {
    const poeAverages = calculateAverageByPOE(data);
    const overallAverage = calculateAverage(data);
    
    const exportData = [
      {
        'KPI Type': `Average KPI (All)`,
        'POE': 'ALL',
        'Average Hours': overallAverage.toFixed(2),
        'Record Count': data.length
      },
      ...poeAverages.map(poeData => ({
        'KPI Type': `Average KPI (${poeData.poe})`,
        'POE': poeData.poe,
        'Average Hours': poeData.average.toFixed(2),
        'Record Count': poeData.count
      }))
    ];
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${kpiType}_Summary`);
    
    const filename = `${kpiType.replace(/\s+/g, '_')}_Summary_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="average-kpi-container">
      <header className="average-kpi-header">
        <h1>KPI Analysis</h1>
        <p className="header-subtitle">Transit time analysis by shipment</p>
      </header>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-group">
          <label className="filter-label">POE:</label>
          <select
            value={selectedPOE}
            onChange={(e) => setSelectedPOE(e.target.value)}
            className="filter-select"
          >
            {availablePOEs.map(poe => (
              <option key={poe} value={poe}>{poe}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Type of Entry:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="date-range-group">
          <label className="filter-label">ATA Date Range:</label>
          <div className="date-inputs">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="date-input"
              min="2025-07-01"
            />
            <span className="date-separator">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="date-input"
              min={fromDate || "2025-07-01"}
            />
          </div>
        </div>

        {uploadedData && (
          <div className="file-info">
            File: {uploadedData.fileName} | Data Type: {uploadedData.dataType}
          </div>
        )}
      </div>

      {/* KPI Visualization Chart Section */}
      <div className="kpi-table-section">
        <div className="section-header">
          <h2 className="section-title">
            KPI Visualization
            <span className="record-count">
              {chartViewType === 'overall' ? '(Average hours by POE)' : `(MAWB count < ${standardizationThreshold}h by POE)`}
            </span>
          </h2>
          <div className="chart-filter-group" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {/* View Type Slicer */}
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={() => setChartViewType('overall')}
                style={{
                  padding: '6px 12px',
                  border: '2px solid #667eea',
                  borderRadius: '6px',
                  background: chartViewType === 'overall' ? '#667eea' : 'white',
                  color: chartViewType === 'overall' ? 'white' : '#667eea',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.3s ease'
                }}
              >
                Overall Average
              </button>
              <button
                onClick={() => setChartViewType('standardization')}
                style={{
                  padding: '6px 12px',
                  border: '2px solid #667eea',
                  borderRadius: '6px',
                  background: chartViewType === 'standardization' ? '#667eea' : 'white',
                  color: chartViewType === 'standardization' ? 'white' : '#667eea',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.3s ease'
                }}
              >
                Standardization
              </button>
            </div>
            
            {/* Threshold Selector for Standardization */}
            {chartViewType === 'standardization' && (
              <>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => setStandardizationThreshold(48)}
                    style={{
                      padding: '6px 12px',
                      border: '2px solid #28a745',
                      borderRadius: '6px',
                      background: standardizationThreshold === 48 ? '#28a745' : 'white',
                      color: standardizationThreshold === 48 ? 'white' : '#28a745',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    48h
                  </button>
                  <button
                    onClick={() => setStandardizationThreshold(72)}
                    style={{
                      padding: '6px 12px',
                      border: '2px solid #28a745',
                      borderRadius: '6px',
                      background: standardizationThreshold === 72 ? '#28a745' : 'white',
                      color: standardizationThreshold === 72 ? 'white' : '#28a745',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    72h
                  </button>
                </div>
                
                {/* Sort Order Selector for Standardization */}
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => setStandardizationSortOrder('desc')}
                    style={{
                      padding: '6px 12px',
                      border: '2px solid #6c757d',
                      borderRadius: '6px',
                      background: standardizationSortOrder === 'desc' ? '#6c757d' : 'white',
                      color: standardizationSortOrder === 'desc' ? 'white' : '#6c757d',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      transition: 'all 0.3s ease'
                    }}
                    title="Sort descending (highest percentage first)"
                  >
                    ↓ High to Low
                  </button>
                  <button
                    onClick={() => setStandardizationSortOrder('asc')}
                    style={{
                      padding: '6px 12px',
                      border: '2px solid #6c757d',
                      borderRadius: '6px',
                      background: standardizationSortOrder === 'asc' ? '#6c757d' : 'white',
                      color: standardizationSortOrder === 'asc' ? 'white' : '#6c757d',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      transition: 'all 0.3s ease'
                    }}
                    title="Sort ascending (lowest percentage first)"
                  >
                    ↑ Low to High
                  </button>
                </div>
              </>
            )}
            
            {/* KPI Type Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label className="filter-label">KPI Type:</label>
              <select
                value={selectedChartKPI}
                onChange={(e) => setSelectedChartKPI(e.target.value)}
                className="filter-select"
              >
                <option value="ATA to Released">ATA to Released</option>
                <option value="ATA to ConsigntoFM">ATA to ConsigntoFM</option>
                <option value="ATA to Handover">ATA to Handover</option>
                <option value="ATA to FinalReleased">ATA to FinalReleased</option>
              </select>
            </div>
          </div>
        </div>
        
        {getChartData.length > 0 ? (
          <div className="chart-wrapper">
            <div style={{ width: '100%', height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', padding: '20px', height: '350px' }}>
                {getChartData.map((item, index) => {
                  if (chartViewType === 'overall') {
                    // Original average hours view
                    const allValues = getChartData.map(d => d.value);
                    const minValue = Math.min(...allValues);
                    const maxValue = Math.max(...allValues);
                    
                    const range = maxValue - minValue;
                    const padding = range * 0.1;
                    const adjustedMin = minValue - padding;
                    const adjustedMax = maxValue + padding;
                    const adjustedRange = adjustedMax - adjustedMin;
                    
                    const normalizedHeight = ((item.value - adjustedMin) / adjustedRange) * 280;
                    const barHeight = Math.max(normalizedHeight, 5);
                    
                    return (
                      <div key={index} style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        height: '320px',
                        justifyContent: 'flex-end'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ 
                            marginBottom: '2px', 
                            fontSize: '12px', 
                            fontWeight: 'bold',
                            color: item.value < 0 ? '#ff4757' : '#333'
                          }}>
                            {item.value.toFixed(1)}h
                          </div>
                          
                          <div 
                            style={{
                              width: '60px',
                              height: `${barHeight}px`,
                              background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
                              borderRadius: '8px 8px 0 0',
                              transition: 'all 0.3s ease',
                              cursor: 'pointer'
                            }}
                            title={`${item.name}: ${item.value.toFixed(2)}h (${item.count} records)`}
                          />
                        </div>
                        
                        <div style={{
                          marginTop: '10px',
                          fontSize: '14px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.name}
                        </div>
                      </div>
                    );
                  } else {
                    // Standardization view - count of MAWB < threshold
                    const percentage = item.count > 0 ? ((item.value / item.count) * 100) : 0;
                    const allPercentages = getChartData.map(d => 
                      d.count > 0 ? ((d.value / d.count) * 100) : 0
                    );
                    const maxPercentage = Math.max(...allPercentages);
                    
                    // Use percentage for bar height instead of count
                    const normalizedHeight = maxPercentage > 0 ? (percentage / maxPercentage) * 280 : 0;
                    const barHeight = Math.max(normalizedHeight, 5);
                    
                    // Calculate counts above threshold
                    const aboveThreshold = item.count - item.value;
                    
                    return (
                      <div key={index} style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        height: '320px',
                        justifyContent: 'flex-end'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ 
                            marginBottom: '5px', 
                            fontSize: '16px', 
                            fontWeight: 'bold',
                            color: '#28a745'
                          }}>
                            {percentage.toFixed(1)}%
                          </div>
                          
                          <div 
                            style={{
                              width: '60px',
                              height: `${barHeight}px`,
                              background: 'linear-gradient(180deg, #28a745 0%, #20c997 100%)',
                              borderRadius: '8px 8px 0 0',
                              transition: 'all 0.3s ease',
                              cursor: 'pointer',
                              position: 'relative'
                            }}
                            title={`${item.name} Details:\n━━━━━━━━━━━━━━━\n< ${standardizationThreshold}h: ${item.value} MAWB\n≥ ${standardizationThreshold}h: ${aboveThreshold} MAWB\n━━━━━━━━━━━━━━━\nTotal: ${item.count} MAWB\nPercentage: ${percentage.toFixed(1)}%`}
                          />
                        </div>
                        
                        <div style={{
                          marginTop: '10px',
                          fontSize: '14px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                          color: '#333'
                        }}>
                          {item.name}
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
              <div style={{ width: '100%', borderTop: '2px solid #e0e0e0' }}></div>
            </div>
            <div className="chart-summary">
              {chartViewType === 'overall' ? (
                <>
                  Total POEs: {getChartData.length} | 
                  Total Records: {getChartData.reduce((sum, item) => sum + item.count, 0)}
                </>
              ) : (
                <>
                  Total POEs: {getChartData.length} | 
                  MAWB &lt; {standardizationThreshold}h: {getChartData.reduce((sum, item) => sum + item.value, 0)} / 
                  Total: {getChartData.reduce((sum, item) => sum + item.count, 0)}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="no-data-message">
            No data available for visualization
          </div>
        )}
      </div>

      {/* ATA to Released Table */}
      <div className="kpi-table-section">
        <div className="section-header">
          <h2 className="section-title">
            ATA to Released
            <span className="record-count">({calculateKPIs.ataToReleased.length} records)</span>
          </h2>
          <span className="kpi-formula"></span>
          {calculateKPIs.ataToReleased.length > 0 && (
            <button 
              onClick={() => exportToExcel(calculateKPIs.ataToReleased, 'ATA to Released')} 
              className="export-button"
            >
              📊 Export
            </button>
          )}
        </div>
        {calculateKPIs.ataToReleased.length > 0 ? (
          <>
            <div className="table-wrapper">
              <table className="kpi-table">
                <thead>
                  <tr>
                    <th>POE</th>
                    <th>MAWB Number</th>
                    <th>ATA Date</th>
                    <th>Released Date</th>
                    <th 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => {
                        if (sortOrder1 === null) setSortOrder1('asc');
                        else if (sortOrder1 === 'asc') setSortOrder1('desc');
                        else setSortOrder1(null);
                      }}
                    >
                      KPI Value {sortOrder1 === 'asc' ? '↑' : sortOrder1 === 'desc' ? '↓' : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortData(calculateKPIs.ataToReleased, sortOrder1).map((row, index) => (
                    <tr key={index}>
                      <td className="port-cell">{row.port}</td>
                      <td className="mawb-cell">{row.mawbNumber}</td>
                      <td className="date-cell">{formatDate(row.ataDate)}</td>
                      <td className="date-cell">{formatDate(row.targetDate)}</td>
                      <td className="kpi-cell">{row.kpiFormatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="average-row-container">
              <table className="average-table">
                <tbody>
                  <tr className="average-row">
                    <td colSpan={4} className="average-label">Average KPI (All)</td>
                    <td className="average-value">
                      {formatHours(calculateAverage(calculateKPIs.ataToReleased))}
                      <button 
                        onClick={() => exportKPISummary(calculateKPIs.ataToReleased, 'ATA to Released')} 
                        className="export-summary-button"
                        title="Export KPI Summary"
                      >
                        📊
                      </button>
                    </td>
                  </tr>
                  {calculateAverageByPOE(calculateKPIs.ataToReleased).map((poeData) => (
                    <tr key={poeData.poe} className="average-row-by-poe">
                      <td colSpan={4} className="average-label-poe">
                        Average KPI ({poeData.poe}) 
                        <span className="poe-count">[{poeData.count} records]</span>
                      </td>
                      <td className="average-value-poe">{formatHours(poeData.average)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="no-data-message">
            No data available for ATA to Released
          </div>
        )}
      </div>

      {/* ATA to Final Released Table */}
      <div className="kpi-table-section">
        <div className="section-header">
          <h2 className="section-title">
            ATA to ConsigntoFM
            <span className="record-count">({calculateKPIs.ataToConsigntoFinal.length} records)</span>
          </h2>
          <span className="kpi-formula"></span>
          {calculateKPIs.ataToConsigntoFinal.length > 0 && (
            <button 
              onClick={() => exportToExcel(calculateKPIs.ataToConsigntoFinal, 'ATA to ConsigntoFM')} 
              className="export-button"
            >
              📊 Export
            </button>
          )}
        </div>
        {calculateKPIs.ataToConsigntoFinal.length > 0 ? (
          <>
            <div className="table-wrapper">
              <table className="kpi-table">
                <thead>
                  <tr>
                    <th>POE</th>
                    <th>MAWB Number</th>
                    <th>ATA Date</th>
                    <th>ConsigntoFM Date</th>
                    <th 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => {
                        if (sortOrder2 === null) setSortOrder2('asc');
                        else if (sortOrder2 === 'asc') setSortOrder2('desc');
                        else setSortOrder2(null);
                      }}
                    >
                      KPI Value {sortOrder2 === 'asc' ? '↑' : sortOrder2 === 'desc' ? '↓' : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortData(calculateKPIs.ataToConsigntoFinal, sortOrder2).map((row, index) => (
                    <tr key={index}>
                      <td className="port-cell">{row.port}</td>
                      <td className="mawb-cell">{row.mawbNumber}</td>
                      <td className="date-cell">{formatDate(row.ataDate)}</td>
                      <td className="date-cell">{formatDate(row.targetDate)}</td>
                      <td className="kpi-cell">{row.kpiFormatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="average-row-container">
              <table className="average-table">
                <tbody>
                  <tr className="average-row">
                    <td colSpan={4} className="average-label">Average KPI (All)</td>
                    <td className="average-value">
                      {formatHours(calculateAverage(calculateKPIs.ataToConsigntoFinal))}
                      <button 
                        onClick={() => exportKPISummary(calculateKPIs.ataToConsigntoFinal, 'ATA to ConsigntoFM')} 
                        className="export-summary-button"
                        title="Export KPI Summary"
                      >
                        📊
                      </button>
                    </td>
                  </tr>
                  {calculateAverageByPOE(calculateKPIs.ataToConsigntoFinal).map((poeData) => (
                    <tr key={poeData.poe} className="average-row-by-poe">
                      <td colSpan={4} className="average-label-poe">
                        Average KPI ({poeData.poe}) 
                        <span className="poe-count">[{poeData.count} records]</span>
                      </td>
                      <td className="average-value-poe">{formatHours(poeData.average)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="no-data-message">
            No data available for ATA to ConsigntoFM
          </div>
        )}
      </div>

      {/* ATA to Handover Table */}
      <div className="kpi-table-section">
        <div className="section-header">
          <h2 className="section-title">
            ATA to Handover
            <span className="record-count">({calculateKPIs.ataToHandover.length} records)</span>
          </h2>
          <span className="kpi-formula"></span>
          {calculateKPIs.ataToHandover.length > 0 && (
            <button 
              onClick={() => exportToExcel(calculateKPIs.ataToHandover, 'ATA to Handover')} 
              className="export-button"
            >
              📊 Export
            </button>
          )}
        </div>
        {calculateKPIs.ataToHandover.length > 0 ? (
          <>
            <div className="table-wrapper">
              <table className="kpi-table">
                <thead>
                  <tr>
                    <th>POE</th>
                    <th>MAWB Number</th>
                    <th>ATA Date</th>
                    <th>Handover Date</th>
                    <th 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => {
                        if (sortOrder3 === null) setSortOrder3('asc');
                        else if (sortOrder3 === 'asc') setSortOrder3('desc');
                        else setSortOrder3(null);
                      }}
                    >
                      KPI Value {sortOrder3 === 'asc' ? '↑' : sortOrder3 === 'desc' ? '↓' : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortData(calculateKPIs.ataToHandover, sortOrder3).map((row, index) => (
                    <tr key={index}>
                      <td className="port-cell">{row.port}</td>
                      <td className="mawb-cell">{row.mawbNumber}</td>
                      <td className="date-cell">{formatDate(row.ataDate)}</td>
                      <td className="date-cell">{formatDate(row.targetDate)}</td>
                      <td className="kpi-cell">{row.kpiFormatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="average-row-container">
              <table className="average-table">
                <tbody>
                  <tr className="average-row">
                    <td colSpan={4} className="average-label">Average KPI (All)</td>
                    <td className="average-value">
                      {formatHours(calculateAverage(calculateKPIs.ataToHandover))}
                      <button 
                        onClick={() => exportKPISummary(calculateKPIs.ataToHandover, 'ATA to Handover')} 
                        className="export-summary-button"
                        title="Export KPI Summary"
                      >
                        📊
                      </button>
                    </td>
                  </tr>
                  {calculateAverageByPOE(calculateKPIs.ataToHandover).map((poeData) => (
                    <tr key={poeData.poe} className="average-row-by-poe">
                      <td colSpan={4} className="average-label-poe">
                        Average KPI ({poeData.poe}) 
                        <span className="poe-count">[{poeData.count} records]</span>
                      </td>
                      <td className="average-value-poe">{formatHours(poeData.average)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="no-data-message">
            No data available for ATA to Handover
          </div>
        )}
      </div>

      {/* ATA to FinalReleased Table */}
      <div className="kpi-table-section">
        <div className="section-header">
          <h2 className="section-title">
            ATA to FinalReleased
            <span className="record-count">({calculateKPIs.ataToFinalReleased.length} records)</span>
          </h2>
          <span className="kpi-formula"></span>
          {calculateKPIs.ataToFinalReleased.length > 0 && (
            <button 
              onClick={() => exportToExcel(calculateKPIs.ataToFinalReleased, 'ATA to FinalReleased')} 
              className="export-button"
            >
              📊 Export
            </button>
          )}
        </div>
        {calculateKPIs.ataToFinalReleased.length > 0 ? (
          <>
            <div className="table-wrapper">
              <table className="kpi-table">
                <thead>
                  <tr>
                    <th>POE</th>
                    <th>MAWB Number</th>
                    <th>ATA Date</th>
                    <th>FinalReleased Date</th>
                    <th 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => {
                        if (sortOrder4 === null) setSortOrder4('asc');
                        else if (sortOrder4 === 'asc') setSortOrder4('desc');
                        else setSortOrder4(null);
                      }}
                    >
                      KPI Value {sortOrder4 === 'asc' ? '↑' : sortOrder4 === 'desc' ? '↓' : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortData(calculateKPIs.ataToFinalReleased, sortOrder4).map((row, index) => (
                    <tr key={index}>
                      <td className="port-cell">{row.port}</td>
                      <td className="mawb-cell">{row.mawbNumber}</td>
                      <td className="date-cell">{formatDate(row.ataDate)}</td>
                      <td className="date-cell">{formatDate(row.targetDate)}</td>
                      <td className="kpi-cell">{row.kpiFormatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="average-row-container">
              <table className="average-table">
                <tbody>
                  <tr className="average-row">
                    <td colSpan={4} className="average-label">Average KPI (All)</td>
                    <td className="average-value">
                      {formatHours(calculateAverage(calculateKPIs.ataToFinalReleased))}
                      <button 
                        onClick={() => exportKPISummary(calculateKPIs.ataToFinalReleased, 'ATA to FinalReleased')} 
                        className="export-summary-button"
                        title="Export KPI Summary"
                      >
                        📊
                      </button>
                    </td>
                  </tr>
                  {calculateAverageByPOE(calculateKPIs.ataToFinalReleased).map((poeData) => (
                    <tr key={poeData.poe} className="average-row-by-poe">
                      <td colSpan={4} className="average-label-poe">
                        Average KPI ({poeData.poe}) 
                        <span className="poe-count">[{poeData.count} records]</span>
                      </td>
                      <td className="average-value-poe">{formatHours(poeData.average)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="no-data-message">
            No data available for ATA to FinalReleased
          </div>
        )}
      </div>
    </div>
  );
};

export default AverageKPI;