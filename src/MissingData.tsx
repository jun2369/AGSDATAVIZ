import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import './MissingData.css';

interface PGAEntry {
  port: string;
  mawbNumber: string;
  category: string;
}

interface MissingMilestoneEntry {
  port: string;
  mawbNumber: string;
  category: string;
  consignedDate: Date;
  creationTime: Date | null;
  missingMilestones: string;
}

interface MissingDataProps {
  uploadedData?: any;
}

type SortDirection = 'asc' | 'desc' | null;
type SortField = 'port' | 'mawbNumber' | 'creationTime' | 'missingMilestones';

const MissingData: React.FC<MissingDataProps> = ({ uploadedData }) => {
  const [pgaEntries, setPgaEntries] = useState<PGAEntry[]>([]);
  const [filteredPGAEntries, setFilteredPGAEntries] = useState<PGAEntry[]>([]);
  const [missingMilestones, setMissingMilestones] = useState<MissingMilestoneEntry[]>([]);
  const [filteredMilestones, setFilteredMilestones] = useState<MissingMilestoneEntry[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPort, setSelectedPort] = useState<string>('ALL');
  const [availableCategories, setAvailableCategories] = useState<string[]>(['ALL']);
  const [availablePorts] = useState<string[]>(['ALL', 'ORD', 'JFK', 'MIA', 'LAX', 'DFW', 'SFO']);
  
  // Separate pagination states for each table - default changed to 20
  const [pgaCurrentPage, setPgaCurrentPage] = useState(1);
  const [pgaPageSize, setPgaPageSize] = useState(20);
  const [milestoneCurrentPage, setMilestoneCurrentPage] = useState(1);
  const [milestonePageSize, setMilestonePageSize] = useState(20);

  // Search states for PGA table
  const [pgaPortSearch, setPgaPortSearch] = useState('');
  const [pgaMawbSearch, setPgaMawbSearch] = useState('');
  
  // Search states for Milestone table
  const [milestonePortSearch, setMilestonePortSearch] = useState('');
  const [milestoneMawbSearch, setMilestoneMawbSearch] = useState('');
  const [milestoneCreationSearch, setMilestoneCreationSearch] = useState('');
  const [milestoneMissingSearch, setMilestoneMissingSearch] = useState('');

  // Sort states for PGA table
  const [pgaSortField, setPgaSortField] = useState<'port' | 'mawbNumber' | null>(null);
  const [pgaSortDirection, setPgaSortDirection] = useState<SortDirection>(null);

  // Sort states for Milestone table
  const [milestoneSortField, setMilestoneSortField] = useState<SortField | null>(null);
  const [milestoneSortDirection, setMilestoneSortDirection] = useState<SortDirection>(null);

  // Column mappings for missing milestones
  const milestoneColumns: { [key: number]: string } = {
    22: 'Handover Time',
    17: 'Release Date',
    18: 'CPSC/PGA Check Date',
    19: 'CPSC/PGA Release Date',
    20: 'Custom Final Release'
  };

  // Helper function to parse Excel date
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

  // Check if a value is empty
  const isEmpty = (value: any): boolean => {
    return value === null || value === undefined || String(value).trim() === '';
  };

  // Process Excel data
  const processExcelData = (data: any[]) => {
    console.log('Starting to process data for PGA Entry Status and Missing Milestones, total rows:', data.length);
    
    const filterDate = new Date('2025-07-01');
    const processedPGAEntries: PGAEntry[] = [];
    const processedMilestones: MissingMilestoneEntry[] = [];
    const categories = new Set<string>(['ALL']);
    let validPGACount = 0;
    let validMilestoneCount = 0;
    let filteredByDateCount = 0;

    // Start from row 3 (index 2)
    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) continue;

      // D column (index 3): Date to filter
      const dateToCheck = parseExcelDate(row[3]);
      if (dateToCheck && dateToCheck < filterDate) {
        filteredByDateCount++;
        continue;
      }

      // Common data extraction
      const category = String(row[0] || '').trim().toUpperCase();
      const port = String(row[1] || '').trim().toUpperCase();
      const mawbNumber = String(row[2] || '').trim();

      // Add category to the list if it's valid
      if (category === 'T01' || category === 'T86') {
        categories.add(category);
      }

      // Only process if port is in our list
      if (port && ['ORD', 'JFK', 'MIA', 'LAX', 'DFW', 'SFO'].includes(port)) {
        
        // 1. PGA Entry Status Check - G column (index 6)
        const pgaStatus = String(row[7] || '').trim().toUpperCase();
        if (pgaStatus === 'N') {
          processedPGAEntries.push({
            category,
            port,
            mawbNumber
          });
          validPGACount++;
        }

        // 2. T01 Missing Milestone Check - Check ALL T01 records, not just those with Consigned Date
        if (category === 'T01') {
          // Check these specific columns for missing data
          const columnsToCheck: { [key: number]: any } = {
            15: row[15], // P column - Handover Time
            10: row[10], // K column - Release Date
            11: row[11], // L column - CPSC/PGA Check Date
            12: row[12], // M column - CPSC/PGA Release Date
            13: row[13]  // N column - Custom Final Release
          };
          
          const missingColumns: string[] = [];
          Object.entries(columnsToCheck).forEach(([index, value]) => {
            const indexNum = parseInt(index);
            if (isEmpty(value) && milestoneColumns[indexNum]) {
              missingColumns.push(milestoneColumns[indexNum]);
            }
          });
          
          // Record if ANY milestone is missing (1, 2, 3, 4, or all 5)
          if (missingColumns.length > 0) {
            // Get consigned date if it exists (for reference, but not required)
            const consignedDateValue = row[14]; // O column - Consigned Date
            const consignedDate = parseExcelDate(consignedDateValue);
            
            // Get creation time from column D (index 3)
            const creationTimeValue = row[3]; // D column - Creation Time
            const creationTime = parseExcelDate(creationTimeValue);
            
            processedMilestones.push({
              category,
              port,
              mawbNumber,
              consignedDate: consignedDate || new Date(), // Use current date as fallback if no consigned date
              creationTime: creationTime,
              missingMilestones: missingColumns.join(', ')
            });
            validMilestoneCount++;
          }
        }
      }
    }

    console.log(`Processing complete:`);
    console.log(`- ${validPGACount} valid PGA "N" entries`);
    console.log(`- ${validMilestoneCount} T01 missing milestone entries`);
    console.log(`- ${filteredByDateCount} filtered by date`);
    
    setAvailableCategories(Array.from(categories).sort());
    return { pgaEntries: processedPGAEntries, milestones: processedMilestones };
  };

  useEffect(() => {
    if (uploadedData && uploadedData.data && Array.isArray(uploadedData.data)) {
      console.log('MissingData received data, processing...');
      const { pgaEntries, milestones } = processExcelData(uploadedData.data);
      setPgaEntries(pgaEntries);
      setFilteredPGAEntries(pgaEntries);
      setMissingMilestones(milestones);
      setFilteredMilestones(milestones);
    }
  }, [uploadedData]);

  // Handle PGA table sorting
  const handlePgaSort = (field: 'port' | 'mawbNumber') => {
    if (pgaSortField === field) {
      if (pgaSortDirection === 'asc') {
        setPgaSortDirection('desc');
      } else if (pgaSortDirection === 'desc') {
        setPgaSortDirection(null);
        setPgaSortField(null);
      }
    } else {
      setPgaSortField(field);
      setPgaSortDirection('asc');
    }
  };

  // Handle Milestone table sorting
  const handleMilestoneSort = (field: SortField) => {
    if (milestoneSortField === field) {
      if (milestoneSortDirection === 'asc') {
        setMilestoneSortDirection('desc');
      } else if (milestoneSortDirection === 'desc') {
        setMilestoneSortDirection(null);
        setMilestoneSortField(null);
      }
    } else {
      setMilestoneSortField(field);
      setMilestoneSortDirection('asc');
    }
  };

  // Apply filters and sorting for PGA entries
  const processedPGAEntries = useMemo(() => {
    let filtered = [...pgaEntries];

    if (selectedCategory !== 'ALL') {
      filtered = filtered.filter(entry => entry.category === selectedCategory);
    }

    if (selectedPort !== 'ALL') {
      filtered = filtered.filter(entry => entry.port === selectedPort);
    }

    // Apply search filters
    if (pgaPortSearch) {
      filtered = filtered.filter(entry => 
        entry.port.toLowerCase().includes(pgaPortSearch.toLowerCase())
      );
    }

    if (pgaMawbSearch) {
      filtered = filtered.filter(entry => 
        entry.mawbNumber.toLowerCase().includes(pgaMawbSearch.toLowerCase())
      );
    }

    // Apply sorting
    if (pgaSortField && pgaSortDirection) {
      filtered.sort((a, b) => {
        const aVal = a[pgaSortField] || '';
        const bVal = b[pgaSortField] || '';
        
        if (pgaSortDirection === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
    }

    return filtered;
  }, [pgaEntries, selectedCategory, selectedPort, pgaPortSearch, pgaMawbSearch, pgaSortField, pgaSortDirection]);

  // Apply filters and sorting for Missing Milestones
  const processedMilestones = useMemo(() => {
    let filtered = [...missingMilestones];

    if (selectedPort !== 'ALL') {
      filtered = filtered.filter(entry => entry.port === selectedPort);
    }

    // Apply search filters
    if (milestonePortSearch) {
      filtered = filtered.filter(entry => 
        entry.port.toLowerCase().includes(milestonePortSearch.toLowerCase())
      );
    }

    if (milestoneMawbSearch) {
      filtered = filtered.filter(entry => 
        entry.mawbNumber.toLowerCase().includes(milestoneMawbSearch.toLowerCase())
      );
    }

    if (milestoneCreationSearch) {
      filtered = filtered.filter(entry => {
        if (!entry.creationTime) return false;
        const dateStr = entry.creationTime.toLocaleDateString();
        return dateStr.includes(milestoneCreationSearch);
      });
    }

    // Simple Missing Milestone search
    if (milestoneMissingSearch) {
      filtered = filtered.filter(entry => 
        entry.missingMilestones.toLowerCase().includes(milestoneMissingSearch.toLowerCase())
      );
    }

    // Apply sorting
    if (milestoneSortField && milestoneSortDirection) {
      filtered.sort((a, b) => {
        let aVal: any = a[milestoneSortField];
        let bVal: any = b[milestoneSortField];
        
        // Handle null values for dates
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';
        
        if (milestoneSortDirection === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
    }

    return filtered;
  }, [missingMilestones, selectedPort, milestonePortSearch, milestoneMawbSearch, milestoneCreationSearch, milestoneMissingSearch, milestoneSortField, milestoneSortDirection]);

  // Update filtered entries whenever processed entries change or search changes
  useEffect(() => {
    setFilteredPGAEntries(processedPGAEntries);
    setPgaCurrentPage(1);
  }, [processedPGAEntries]);

  useEffect(() => {
    setFilteredMilestones(processedMilestones);
    setMilestoneCurrentPage(1);
  }, [processedMilestones]);

  // Export to Excel function
  const exportToExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  // Export PGA data
  const exportPGAData = () => {
    const dataToExport = paginatedPGAData.map((entry, index) => ({
      '#': pgaStartIndex + index + 1,
      'Port': entry.port,
      'MAWB Number': entry.mawbNumber
    }));
    exportToExcel(dataToExport, `PGA_Entry_Status_${new Date().toISOString().split('T')[0]}`);
  };

  // Export Milestone data
  const exportMilestoneData = () => {
    const dataToExport = paginatedMilestoneData.map((entry, index) => ({
      '#': milestoneStartIndex + index + 1,
      'Port': entry.port,
      'MAWB Number': entry.mawbNumber,
      'Creation Time': entry.creationTime ? entry.creationTime.toLocaleDateString() : '',
      'Missing Milestone': entry.missingMilestones
    }));
    exportToExcel(dataToExport, `T01_Missing_Milestones_${new Date().toISOString().split('T')[0]}`);
  };

  // PGA Pagination calculations
  const pgaTotalPages = Math.ceil(filteredPGAEntries.length / pgaPageSize);
  const pgaStartIndex = (pgaCurrentPage - 1) * pgaPageSize;
  const pgaEndIndex = pgaStartIndex + pgaPageSize;
  const paginatedPGAData = filteredPGAEntries.slice(pgaStartIndex, pgaEndIndex);

  // Milestone Pagination calculations
  const milestoneTotalPages = Math.ceil(filteredMilestones.length / milestonePageSize);
  const milestoneStartIndex = (milestoneCurrentPage - 1) * milestonePageSize;
  const milestoneEndIndex = milestoneStartIndex + milestonePageSize;
  const paginatedMilestoneData = filteredMilestones.slice(milestoneStartIndex, milestoneEndIndex);

  return (
    <div className="missing-data-container">
      <header className="missing-data-header">
        <h1>Data Quality Monitor</h1>
        <p className="header-subtitle"></p>
      </header>

      {/* Filters Section */}
      <div className="filters-section">
        {availableCategories.length > 1 && (
          <div className="filter-group">
            <label className="filter-label">Category:</label>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select category-filter"
            >
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group">
          <label className="filter-label">Port:</label>
          <select 
            value={selectedPort} 
            onChange={(e) => setSelectedPort(e.target.value)}
            className="filter-select"
          >
            {availablePorts.map(port => (
              <option key={port} value={port}>{port}</option>
            ))}
          </select>
        </div>

        {uploadedData && (
          <div className="file-info">
            File: {uploadedData.fileName} | Total rows: {uploadedData.data?.length || 0}
            {selectedCategory !== 'ALL' && ` | Category: ${selectedCategory}`}
            {selectedPort !== 'ALL' && ` | Port: ${selectedPort}`}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="stat-box">
          <div className="stat-number">{filteredPGAEntries.length}</div>
          <div className="stat-label">PGA "N" Entries</div>
        </div>
        <div className="stat-box" style={{ borderTopColor: '#dc3545' }}>
          <div className="stat-number">{filteredMilestones.length}</div>
          <div className="stat-label">T01 shipment with Missing Milestones</div>
        </div>
      </div>

      {/* PGA Entry Status Table */}
      <div className="pga-table-section">
        <div className="table-header-row">
          <h3 className="table-title">PGA Entry Status "N" Records ({filteredPGAEntries.length} total)</h3>
          <button className="export-btn" onClick={exportPGAData} disabled={paginatedPGAData.length === 0}>
            📊 Export to Excel
          </button>
        </div>
        
        <table className="pga-table">
          <thead>
            <tr>
              <th>#</th>
              <th>
                <div className="header-with-controls">
                  <span>Port</span>
                  <div className="header-controls">
                    <button 
                      className={`sort-btn ${pgaSortField === 'port' ? pgaSortDirection : ''}`}
                      onClick={() => handlePgaSort('port')}
                      title="Sort"
                    >
                      {pgaSortField === 'port' && pgaSortDirection === 'asc' ? '↑' : 
                       pgaSortField === 'port' && pgaSortDirection === 'desc' ? '↓' : '↕'}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  className="column-search"
                  placeholder="Search port..."
                  value={pgaPortSearch}
                  onChange={(e) => setPgaPortSearch(e.target.value)}
                />
              </th>
              <th>
                <div className="header-with-controls">
                  <span>MAWB Number</span>
                  <div className="header-controls">
                    <button 
                      className={`sort-btn ${pgaSortField === 'mawbNumber' ? pgaSortDirection : ''}`}
                      onClick={() => handlePgaSort('mawbNumber')}
                      title="Sort"
                    >
                      {pgaSortField === 'mawbNumber' && pgaSortDirection === 'asc' ? '↑' : 
                       pgaSortField === 'mawbNumber' && pgaSortDirection === 'desc' ? '↓' : '↕'}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  className="column-search"
                  placeholder="Search MAWB..."
                  value={pgaMawbSearch}
                  onChange={(e) => setPgaMawbSearch(e.target.value)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedPGAData.length > 0 ? (
              paginatedPGAData.map((entry, index) => (
                <tr key={index}>
                  <td>{pgaStartIndex + index + 1}</td>
                  <td>{entry.port}</td>
                  <td>{entry.mawbNumber}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="no-data-cell">
                  {pgaPortSearch || pgaMawbSearch ? 'No matching records found' : 'No PGA Entry Status "N" records found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* PGA Pagination Controls */}
        {filteredPGAEntries.length > 0 && (
          <div className="pagination-controls">
            <div className="page-size-control">
              <label>Page Size:</label>
              <select
                value={pgaPageSize}
                onChange={(e) => {
                  setPgaPageSize(Number(e.target.value));
                  setPgaCurrentPage(1);
                }}
                className="page-size-select"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={25}>25</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <span className="showing-text">
                Showing {pgaStartIndex + 1} to {Math.min(pgaEndIndex, filteredPGAEntries.length)} of {filteredPGAEntries.length}
              </span>
            </div>

            <div className="page-navigation">
              <button
                onClick={() => setPgaCurrentPage(1)}
                disabled={pgaCurrentPage === 1}
                className="page-btn"
              >
                ⏮
              </button>
              <button
                onClick={() => setPgaCurrentPage(pgaCurrentPage - 1)}
                disabled={pgaCurrentPage === 1}
                className="page-btn"
              >
                ◀
              </button>
              <span className="page-info">
                Page {pgaCurrentPage} of {pgaTotalPages || 1}
              </span>
              <button
                onClick={() => setPgaCurrentPage(pgaCurrentPage + 1)}
                disabled={pgaCurrentPage === pgaTotalPages}
                className="page-btn"
              >
                ▶
              </button>
              <button
                onClick={() => setPgaCurrentPage(pgaTotalPages)}
                disabled={pgaCurrentPage === pgaTotalPages}
                className="page-btn"
              >
                ⏭
              </button>
            </div>
          </div>
        )}
      </div>

      {/* T01 Missing Milestone Table */}
      <div className="pga-table-section milestone-section">
        <div className="table-header-row">
          <h3 className="table-title milestone-title">
            T01 shipment with Missing Milestones ({filteredMilestones.length} total)
            <span className="info-icon-wrapper">
              <span className="info-icon">⚠️</span>
              <span className="tooltip">
                Missing milestones are detected for ALL T01 shipments: Handover Time, Release Date, CPSC/PGA Check Date, CPSC/PGA Release Date, and Custom Final Release. Any combination of missing fields (1, 2, 3, 4, or all 5) will be shown.
              </span>
            </span>
          </h3>
          <button className="export-btn" onClick={exportMilestoneData} disabled={paginatedMilestoneData.length === 0}>
            📊 Export to Excel
          </button>
        </div>
        <p className="table-subtitle">All T01 shipments missing data in any of: Handover Time, Release Date, CPSC/PGA Check Date, CPSC/PGA Release Date, or Custom Final Release</p>
        
        <table className="pga-table">
          <thead>
            <tr>
              <th>#</th>
              <th>
                <div className="header-with-controls">
                  <span>Port</span>
                  <div className="header-controls">
                    <button 
                      className={`sort-btn ${milestoneSortField === 'port' ? milestoneSortDirection : ''}`}
                      onClick={() => handleMilestoneSort('port')}
                      title="Sort"
                    >
                      {milestoneSortField === 'port' && milestoneSortDirection === 'asc' ? '↑' : 
                       milestoneSortField === 'port' && milestoneSortDirection === 'desc' ? '↓' : '↕'}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  className="column-search"
                  placeholder="Search port..."
                  value={milestonePortSearch}
                  onChange={(e) => setMilestonePortSearch(e.target.value)}
                />
              </th>
              <th>
                <div className="header-with-controls">
                  <span>MAWB Number</span>
                  <div className="header-controls">
                    <button 
                      className={`sort-btn ${milestoneSortField === 'mawbNumber' ? milestoneSortDirection : ''}`}
                      onClick={() => handleMilestoneSort('mawbNumber')}
                      title="Sort"
                    >
                      {milestoneSortField === 'mawbNumber' && milestoneSortDirection === 'asc' ? '↑' : 
                       milestoneSortField === 'mawbNumber' && milestoneSortDirection === 'desc' ? '↓' : '↕'}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  className="column-search"
                  placeholder="Search MAWB..."
                  value={milestoneMawbSearch}
                  onChange={(e) => setMilestoneMawbSearch(e.target.value)}
                />
              </th>
              <th>
                <div className="header-with-controls">
                  <span>Creation Time</span>
                  <div className="header-controls">
                    <button 
                      className={`sort-btn ${milestoneSortField === 'creationTime' ? milestoneSortDirection : ''}`}
                      onClick={() => handleMilestoneSort('creationTime')}
                      title="Sort"
                    >
                      {milestoneSortField === 'creationTime' && milestoneSortDirection === 'asc' ? '↑' : 
                       milestoneSortField === 'creationTime' && milestoneSortDirection === 'desc' ? '↓' : '↕'}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  className="column-search"
                  placeholder="Search date..."
                  value={milestoneCreationSearch}
                  onChange={(e) => setMilestoneCreationSearch(e.target.value)}
                />
              </th>
              <th>
                <div className="header-with-controls">
                  <span>Missing Milestone</span>
                  <div className="header-controls">
                    <button 
                      className={`sort-btn ${milestoneSortField === 'missingMilestones' ? milestoneSortDirection : ''}`}
                      onClick={() => handleMilestoneSort('missingMilestones')}
                      title="Sort"
                    >
                      {milestoneSortField === 'missingMilestones' && milestoneSortDirection === 'asc' ? '↑' : 
                       milestoneSortField === 'missingMilestones' && milestoneSortDirection === 'desc' ? '↓' : '↕'}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  className="column-search"
                  placeholder="Search milestone..."
                  value={milestoneMissingSearch}
                  onChange={(e) => setMilestoneMissingSearch(e.target.value)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedMilestoneData.length > 0 ? (
              paginatedMilestoneData.map((entry, index) => (
                <tr key={index}>
                  <td>{milestoneStartIndex + index + 1}</td>
                  <td>{entry.port}</td>
                  <td>{entry.mawbNumber}</td>
                  <td>{entry.creationTime ? entry.creationTime.toLocaleDateString() : ''}</td>
                  <td className="missing-milestones-column">{entry.missingMilestones}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="no-data-cell">
                  {milestonePortSearch || milestoneMawbSearch || milestoneCreationSearch || milestoneMissingSearch ? 'No matching records found' : 'No T01 missing milestone records found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Milestone Pagination Controls */}
        {filteredMilestones.length > 0 && (
          <div className="pagination-controls">
            <div className="page-size-control">
              <label>Page Size:</label>
              <select
                value={milestonePageSize}
                onChange={(e) => {
                  setMilestonePageSize(Number(e.target.value));
                  setMilestoneCurrentPage(1);
                }}
                className="page-size-select"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={25}>25</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <span className="showing-text">
                Showing {milestoneStartIndex + 1} to {Math.min(milestoneEndIndex, filteredMilestones.length)} of {filteredMilestones.length}
              </span>
            </div>

            <div className="page-navigation">
              <button
                onClick={() => setMilestoneCurrentPage(1)}
                disabled={milestoneCurrentPage === 1}
                className="page-btn"
              >
                ⏮
              </button>
              <button
                onClick={() => setMilestoneCurrentPage(milestoneCurrentPage - 1)}
                disabled={milestoneCurrentPage === 1}
                className="page-btn"
              >
                ◀
              </button>
              <span className="page-info">
                Page {milestoneCurrentPage} of {milestoneTotalPages || 1}
              </span>
              <button
                onClick={() => setMilestoneCurrentPage(milestoneCurrentPage + 1)}
                disabled={milestoneCurrentPage === milestoneTotalPages}
                className="page-btn"
              >
                ▶
              </button>
              <button
                onClick={() => setMilestoneCurrentPage(milestoneTotalPages)}
                disabled={milestoneCurrentPage === milestoneTotalPages}
                className="page-btn"
              >
                ⏭
              </button>
            </div>
          </div>
        )}
      </div>

      {/* No Data Section */}
      {!uploadedData && (
        <div className="no-data-section">
          <span className="no-data-icon">📁</span>
          <p>Please upload an Excel file to view data quality issues</p>
        </div>
      )}
    </div>
  );
};

export default MissingData;