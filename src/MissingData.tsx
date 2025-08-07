import React, { useState, useEffect } from 'react';
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
}

interface MissingDataProps {
  uploadedData?: any;
}

const MissingData: React.FC<MissingDataProps> = ({ uploadedData }) => {
  const [pgaEntries, setPgaEntries] = useState<PGAEntry[]>([]);
  const [filteredPGAEntries, setFilteredPGAEntries] = useState<PGAEntry[]>([]);
  const [missingMilestones, setMissingMilestones] = useState<MissingMilestoneEntry[]>([]);
  const [filteredMilestones, setFilteredMilestones] = useState<MissingMilestoneEntry[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPort, setSelectedPort] = useState<string>('ALL');
  const [availableCategories, setAvailableCategories] = useState<string[]>(['ALL']);
  const [availablePorts] = useState<string[]>(['ALL', 'ORD', 'JFK', 'MIA', 'LAX', 'DFW', 'SFO']);
  
  // Separate pagination states for each table
  const [pgaCurrentPage, setPgaCurrentPage] = useState(1);
  const [pgaPageSize, setPgaPageSize] = useState(30);
  const [milestoneCurrentPage, setMilestoneCurrentPage] = useState(1);
  const [milestonePageSize, setMilestonePageSize] = useState(30);

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
        continue; // Skip data before 2025-07-01
      }

      // Common data extraction
      const category = String(row[0] || '').trim().toUpperCase(); // A column
      const port = String(row[1] || '').trim().toUpperCase(); // B column
      const mawbNumber = String(row[2] || '').trim(); // C column

      // Add category to the list if it's valid
      if (category === 'T01' || category === 'T86') {
        categories.add(category);
      }

      // Only process if port is in our list
      if (port && ['ORD', 'JFK', 'MIA', 'LAX', 'DFW', 'SFO'].includes(port)) {
        
        // 1. PGA Entry Status Check - G column (index 6)
        const pgaStatus = String(row[6] || '').trim().toUpperCase();
        if (pgaStatus === 'N') {
          processedPGAEntries.push({
            category,
            port,
            mawbNumber
          });
          validPGACount++;
        }

        // 2. T01 Missing Milestone Check
        // O column (index 14): Consigned to Final Mile Carrier Date
        const consignedDateValue = row[14];
        const consignedDate = parseExcelDate(consignedDateValue);
        
        // Only process if O column is not empty and category is T01
        if (consignedDate && category === 'T01') {
          // Check columns P(15), N(13), M(12), L(11), K(10)
          const columnsToCheck = [
            row[15], // P column - index 15
            row[13], // N column - index 13
            row[12], // M column - index 12
            row[11], // L column - index 11
            row[10]  // K column - index 10
          ];
          
          // Check if any of these columns is empty
          const hasEmptyColumn = columnsToCheck.some(value => isEmpty(value));
          
          if (hasEmptyColumn) {
            processedMilestones.push({
              category,
              port,
              mawbNumber,
              consignedDate
            });
            validMilestoneCount++;
            
            if (i < 10) { // Log first few for debugging
              console.log(`Row ${i + 1}: T01 Missing Milestone found - Port: ${port}, MAWB: ${mawbNumber}`);
            }
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

  // Apply filters for PGA entries
  useEffect(() => {
    let filtered = [...pgaEntries];

    if (selectedCategory !== 'ALL') {
      filtered = filtered.filter(entry => entry.category === selectedCategory);
    }

    if (selectedPort !== 'ALL') {
      filtered = filtered.filter(entry => entry.port === selectedPort);
    }

    setFilteredPGAEntries(filtered);
    setPgaCurrentPage(1);
  }, [selectedCategory, selectedPort, pgaEntries]);

  // Apply filters for Missing Milestones (T01 only, but still apply port filter)
  useEffect(() => {
    let filtered = [...missingMilestones];

    // T01 missing milestones are already T01 only, but we can still filter by port
    if (selectedPort !== 'ALL') {
      filtered = filtered.filter(entry => entry.port === selectedPort);
    }

    setFilteredMilestones(filtered);
    setMilestoneCurrentPage(1);
  }, [selectedPort, missingMilestones]);

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
        <p className="header-subtitle">PGA Entry Status Check & T01 Missing Milestones</p>
      </header>

      {/* Filters Section */}
      <div className="filters-section">
        {/* Category Filter (T01/T86) */}
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

        {/* Port Filter */}
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

        {/* File Info */}
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
          <div className="stat-label">T01 Missing Milestones</div>
        </div>
        <div className="stat-box" style={{ borderTopColor: '#17a2b8' }}>
          <div className="stat-number">{filteredPGAEntries.length + filteredMilestones.length}</div>
          <div className="stat-label">Total Issues</div>
        </div>
      </div>

      {/* PGA Entry Status Table */}
      <div className="pga-table-section">
        <h3 className="table-title">PGA Entry Status "N" Records ({filteredPGAEntries.length} total)</h3>
        {filteredPGAEntries.length > 0 ? (
          <>
            <table className="pga-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Port (Column B)</th>
                  <th>MAWB Number (Column C)</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPGAData.map((entry, index) => (
                  <tr key={index}>
                    <td>{pgaStartIndex + index + 1}</td>
                    <td>{entry.port}</td>
                    <td>{entry.mawbNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* PGA Pagination Controls */}
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
                  <option value={25}>25</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
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
          </>
        ) : (
          <div className="no-data-message">No PGA Entry Status "N" records found</div>
        )}
      </div>

      {/* T01 Missing Milestone Table */}
      <div className="pga-table-section milestone-section">
        <h3 className="table-title milestone-title">T01 Missing Milestones ({filteredMilestones.length} total)</h3>
        <p className="table-subtitle">Records with O column filled but missing data in P, N, M, L, or K columns</p>
        {filteredMilestones.length > 0 ? (
          <>
            <table className="pga-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Port (Column B)</th>
                  <th>MAWB Number (Column C)</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMilestoneData.map((entry, index) => (
                  <tr key={index}>
                    <td>{milestoneStartIndex + index + 1}</td>
                    <td>{entry.port}</td>
                    <td>{entry.mawbNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Milestone Pagination Controls */}
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
                  <option value={25}>25</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
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
          </>
        ) : (
          <div className="no-data-message">No T01 missing milestone records found</div>
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