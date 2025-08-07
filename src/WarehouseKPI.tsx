import React, { useState, useEffect} from 'react';
import './KPIStyles.css';

interface ExcelRow {
  port: string;
  mawbNumber: string;
  customReleaseDate: Date;
  consignedDate: Date;
  timeDiff: number | null;
  category: string; // 新增：用于存储T01或T86
}

interface ProcessedData {
  zeroTo12: ExcelRow[];
  between12And24: ExcelRow[];
  between24And48: ExcelRow[];
  between48And72: ExcelRow[];
  moreThan72: ExcelRow[];
  lessThanZero: ExcelRow[];
}

interface WarehouseKPIProps {
  uploadedData?: any;
}

type SortDirection = 'asc' | 'desc' | null;
type SortField =
  | 'port'
  | 'mawbNumber'
  | 'customReleaseDate'
  | 'consignedDate'
  | 'timeDiff';

interface TableFilters {
  port: string;
  mawbNumber: string;
  sortField: SortField | null;
  sortDirection: SortDirection;
  currentPage: number;
  pageSize: number;
}

const WarehouseKPI: React.FC<WarehouseKPIProps> = ({ uploadedData }) => {
  const [processedData, setProcessedData] = useState<ProcessedData>({
    zeroTo12: [],
    between12And24: [],
    between24And48: [],
    between48And72: [],
    moreThan72: [],
    lessThanZero: [],
  });
  const [selectedPort, setSelectedPort] = useState<string>('ALL');
  const [availablePorts, setAvailablePorts] = useState<string[]>(['ALL']);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL'); // 新增：T01/T86筛选
  const [availableCategories, setAvailableCategories] = useState<string[]>([
    'ALL',
  ]); // 新增：可用的类别

  // 为每个表格维护独立的过滤器状态
  const [tableFilters, setTableFilters] = useState<
    Record<string, TableFilters>
  >({
    lessThanZero: {
      port: '',
      mawbNumber: '',
      sortField: null,
      sortDirection: null,
      currentPage: 1,
      pageSize: 30,
    },
    zeroTo12: {
      port: '',
      mawbNumber: '',
      sortField: null,
      sortDirection: null,
      currentPage: 1,
      pageSize: 30,
    },
    between12And24: {
      port: '',
      mawbNumber: '',
      sortField: null,
      sortDirection: null,
      currentPage: 1,
      pageSize: 30,
    },
    between24And48: {
      port: '',
      mawbNumber: '',
      sortField: null,
      sortDirection: null,
      currentPage: 1,
      pageSize: 30,
    },
    between48And72: {
      port: '',
      mawbNumber: '',
      sortField: null,
      sortDirection: null,
      currentPage: 1,
      pageSize: 30,
    },
    moreThan72: {
      port: '',
      mawbNumber: '',
      sortField: null,
      sortDirection: null,
      currentPage: 1,
      pageSize: 30,
    },
  });

  // 处理Excel数据
  const processExcelData = (data: any[]) => {
    console.log('Starting to process data, total rows:', data.length);
    console.log('Sample data rows:');
    if (data.length > 2) {
      console.log('Row 2 (first data):', data[2]);
      console.log('  A (Category):', data[2][0]);
      console.log('  B (Port):', data[2][1]);
      console.log('  C (MAWB):', data[2][2]);
      console.log('  D (Date to filter):', data[2][3]);
      console.log('  N (Custom Final Release Date):', data[2][13]);
      console.log('  O (Consigned to Final Mile Carrier Date):', data[2][14]);
    }

    const processed: ProcessedData = {
      zeroTo12: [],
      between12And24: [],
      between24And48: [],
      between48And72: [],
      moreThan72: [],
      lessThanZero: [],
    };

    const ports = new Set<string>(['ALL']);
    const categories = new Set<string>(['ALL']); // 新增：收集类别
    let validCount = 0;
    let skipCount = 0;
    let filteredByDateCount = 0; // 新增：记录被日期过滤的数量

    // Helper function to parse Excel date
    const parseExcelDate = (value: any): Date | null => {
      if (!value) return null;

      // If it's already a Date object
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
      }

      // If it's a number (Excel serial date)
      if (typeof value === 'number') {
        // Excel dates start from 1900-01-01, but JavaScript Date starts from 1970-01-01
        // Excel serial date 1 = 1900-01-01, but Excel incorrectly treats 1900 as a leap year
        const date = new Date((value - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? null : date;
      }

      // If it's a string, try to parse it
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      }

      return null;
    };

    // 设置过滤日期为2025-07-01
    const filterDate = new Date('2025-07-01');
    console.log('Filter date set to:', filterDate.toISOString());

    // Start from row 3 (index 2) as requested
    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) {
        skipCount++;
        continue;
      }

      // D column (index 3): Date to filter - 检查D列日期
      const dateToCheck = parseExcelDate(row[3]);
      if (dateToCheck && dateToCheck < filterDate) {
        filteredByDateCount++;
        if (i < 10) {
          // Log first few filtered rows for debugging
          console.log(
            `Row ${
              i + 1
            }: Filtered out - D column date ${dateToCheck.toISOString()} is before 2025-07-01`
          );
        }
        continue; // 跳过早于2025-07-01的数据
      }

      // A column (index 0): Category (T01 or T86)
      const category = String(row[0] || '')
        .trim()
        .toUpperCase();
      // B column (index 1): Port, C column (index 2): MAWB Number
      const port = String(row[1] || '').trim();
      const mawbNumber = String(row[2] || '').trim();
      // N column (index 13): Custom Final Release Date, O column (index 14): Consigned to Final Mile Carrier Date
      const customReleaseDateValue = row[13]; // N column
      const consignedDateValue = row[14]; // O column

      // Add category to the list if it's valid (T01 or T86)
      if (category === 'T01' || category === 'T86') {
        categories.add(category);
      }

      // Add port to the list if it's valid
      if (port && port !== '' && port !== 'Port') {
        ports.add(port);
      }

      // Parse dates
      const customReleaseDate = parseExcelDate(customReleaseDateValue);
      const consignedDate = parseExcelDate(consignedDateValue);

      // Skip if either date is missing or invalid
      if (!customReleaseDate || !consignedDate) {
        skipCount++;
        if (i < 10) {
          // Log first few skipped rows for debugging
          console.log(
            `Row ${
              i + 1
            }: Skipped - Custom Release Date: ${customReleaseDateValue}, Consigned Date: ${consignedDateValue}`
          );
        }
        continue;
      }

      // Calculate time difference: O column - N column (in hours)
      const timeDiffMs = consignedDate.getTime() - customReleaseDate.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      if (i < 10) {
        // Log first few valid rows for debugging
        console.log(
          `Row ${i + 1}: Category=${category}, Port=${port}, MAWB=${mawbNumber}`
        );
        console.log(
          `  Custom Release Date: ${customReleaseDate.toISOString()}`
        );
        console.log(`  Consigned Date: ${consignedDate.toISOString()}`);
        console.log(`  Time Diff: ${timeDiffHours.toFixed(2)} hours`);
      }

      const rowData: ExcelRow = {
        category,
        port,
        mawbNumber,
        customReleaseDate,
        consignedDate,
        timeDiff: timeDiffHours,
      };

      validCount++;

      // Categorize based on time difference (including negative values)
      if (timeDiffHours < 0) {
        processed.lessThanZero.push(rowData);
      } else if (timeDiffHours < 12) {
        processed.zeroTo12.push(rowData);
      } else if (timeDiffHours < 24) {
        processed.between12And24.push(rowData);
      } else if (timeDiffHours < 48) {
        processed.between24And48.push(rowData);
      } else if (timeDiffHours < 72) {
        processed.between48And72.push(rowData);
      } else {
        processed.moreThan72.push(rowData);
      }
    }

    console.log(
      `Processing complete: ${validCount} valid rows, ${skipCount} skipped rows, ${filteredByDateCount} filtered by date`
    );
    console.log('Category counts:', {
      '<0h': processed.lessThanZero.length,
      '0-12h': processed.zeroTo12.length,
      '12-24h': processed.between12And24.length,
      '24-48h': processed.between24And48.length,
      '48-72h': processed.between48And72.length,
      '>72h': processed.moreThan72.length,
    });

    console.log('Available ports:', Array.from(ports));
    console.log('Available categories:', Array.from(categories));
    setAvailablePorts(Array.from(ports).sort());
    setAvailableCategories(Array.from(categories).sort());
    return processed;
  };

  useEffect(() => {
    if (uploadedData && uploadedData.data && Array.isArray(uploadedData.data)) {
      console.log('WarehouseKPI received data, processing...');
      const processed = processExcelData(uploadedData.data);
      setProcessedData(processed);
    } else {
      console.log('No valid data received:', uploadedData);
    }
  }, [uploadedData]);

  // 过滤数据 - 增加类别过滤
  const filterByPortAndCategory = (data: ExcelRow[]) => {
    let filtered = data;

    // 先按端口过滤
    if (selectedPort !== 'ALL') {
      filtered = filtered.filter((row) => row.port === selectedPort);
    }

    // 再按类别过滤
    if (selectedCategory !== 'ALL') {
      filtered = filtered.filter((row) => row.category === selectedCategory);
    }

    return filtered;
  };

  // 更新表格过滤器
  const updateTableFilter = (
    tableKey: string,
    field: keyof TableFilters,
    value: any
  ) => {
    setTableFilters((prev) => ({
      ...prev,
      [tableKey]: {
        ...prev[tableKey],
        [field]: value,
      },
    }));
  };

  // 处理排序
  const handleSort = (tableKey: string, field: SortField) => {
    const currentFilters = tableFilters[tableKey];
    let newDirection: SortDirection = 'asc';

    if (currentFilters.sortField === field) {
      if (currentFilters.sortDirection === 'asc') {
        newDirection = 'desc';
      } else if (currentFilters.sortDirection === 'desc') {
        newDirection = null;
      }
    }

    updateTableFilter(tableKey, 'sortField', newDirection ? field : null);
    updateTableFilter(tableKey, 'sortDirection', newDirection);
  };

  // 应用过滤和排序
  const applyFiltersAndSort = (
    rows: ExcelRow[],
    tableKey: string
  ): ExcelRow[] => {
    const filters = tableFilters[tableKey];
    let filtered = [...rows];

    // 应用端口过滤
    if (filters.port) {
      filtered = filtered.filter((row) =>
        row.port.toLowerCase().includes(filters.port.toLowerCase())
      );
    }

    // 应用MAWB过滤
    if (filters.mawbNumber) {
      filtered = filtered.filter((row) =>
        row.mawbNumber.toLowerCase().includes(filters.mawbNumber.toLowerCase())
      );
    }

    // 应用排序
    if (filters.sortField && filters.sortDirection) {
      filtered.sort((a, b) => {
        let aValue: any = a[filters.sortField!];
        let bValue: any = b[filters.sortField!];

        if (
          filters.sortField === 'customReleaseDate' ||
          filters.sortField === 'consignedDate'
        ) {
          aValue = aValue.getTime();
          bValue = bValue.getTime();
        } else if (filters.sortField === 'timeDiff') {
          aValue = aValue || 0;
          bValue = bValue || 0;
        }

        if (aValue < bValue) return filters.sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return filters.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };

  // 获取排序图标
  const getSortIcon = (tableKey: string, field: SortField) => {
    const filters = tableFilters[tableKey];
    if (filters.sortField !== field) {
      return '↕️'; // 未排序
    }
    return filters.sortDirection === 'asc' ? '↑' : '↓';
  };

  // 处理页码变化
  const handlePageChange = (tableKey: string, newPage: number) => {
    updateTableFilter(tableKey, 'currentPage', newPage);
  };

  // 处理每页显示数量变化
  const handlePageSizeChange = (tableKey: string, newSize: number) => {
    updateTableFilter(tableKey, 'pageSize', newSize);
    updateTableFilter(tableKey, 'currentPage', 1); // 重置到第一页
  };

  // 渲染表格
  const renderTable = (
    title: string,
    rows: ExcelRow[],
    color: string,
    tableKey: string
  ) => {
    const filteredByPortAndCategory = filterByPortAndCategory(rows);
    if (filteredByPortAndCategory.length === 0) return null;

    const filteredAndSorted = applyFiltersAndSort(
      filteredByPortAndCategory,
      tableKey
    );
    const filters = tableFilters[tableKey];

    // 分页计算
    const totalPages = Math.ceil(filteredAndSorted.length / filters.pageSize);
    const startIndex = (filters.currentPage - 1) * filters.pageSize;
    const endIndex = startIndex + filters.pageSize;
    const paginatedData = filteredAndSorted.slice(startIndex, endIndex);

    return (
      <div className="kpi-table-section" style={{ marginBottom: '30px' }}>
        <h3
          style={{
            color: color,
            borderBottom: `2px solid ${color}`,
            paddingBottom: '10px',
            marginBottom: '15px',
          }}
        >
          {title} ({filteredAndSorted.length} records)
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th
                  style={{
                    padding: '10px',
                    border: '1px solid #dee2e6',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        marginBottom: '5px',
                      }}
                    >
                      <span>Port</span>
                      <button
                        onClick={() => handleSort(tableKey, 'port')}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          fontSize: '12px',
                        }}
                      >
                        {getSortIcon(tableKey, 'port')}
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={filters.port}
                      onChange={(e) => {
                        updateTableFilter(tableKey, 'port', e.target.value);
                        updateTableFilter(tableKey, 'currentPage', 1);
                      }}
                      style={{
                        width: '100%',
                        padding: '4px',
                        fontSize: '12px',
                        border: '1px solid #ccc',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </th>
                <th
                  style={{
                    padding: '10px',
                    border: '1px solid #dee2e6',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        marginBottom: '5px',
                      }}
                    >
                      <span>MAWB Number</span>
                      <button
                        onClick={() => handleSort(tableKey, 'mawbNumber')}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          fontSize: '12px',
                        }}
                      >
                        {getSortIcon(tableKey, 'mawbNumber')}
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={filters.mawbNumber}
                      onChange={(e) => {
                        updateTableFilter(
                          tableKey,
                          'mawbNumber',
                          e.target.value
                        );
                        updateTableFilter(tableKey, 'currentPage', 1);
                      }}
                      style={{
                        width: '100%',
                        padding: '4px',
                        fontSize: '12px',
                        border: '1px solid #ccc',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </th>
                <th
                  style={{
                    padding: '10px',
                    border: '1px solid #dee2e6',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>Custom Final Release Date</span>
                    <button
                      onClick={() => handleSort(tableKey, 'customReleaseDate')}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        fontSize: '12px',
                      }}
                    >
                      {getSortIcon(tableKey, 'customReleaseDate')}
                    </button>
                  </div>
                </th>
                <th
                  style={{
                    padding: '10px',
                    border: '1px solid #dee2e6',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>Consigned to FM Carrier Date</span>
                    <button
                      onClick={() => handleSort(tableKey, 'consignedDate')}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        fontSize: '12px',
                      }}
                    >
                      {getSortIcon(tableKey, 'consignedDate')}
                    </button>
                  </div>
                </th>
                <th
                  style={{
                    padding: '10px',
                    border: '1px solid #dee2e6',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>Time Diff (hours)</span>
                    <button
                      onClick={() => handleSort(tableKey, 'timeDiff')}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        fontSize: '12px',
                      }}
                    >
                      {getSortIcon(tableKey, 'timeDiff')}
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, index) => (
                <tr key={index}>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                    {row.port}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                    {row.mawbNumber}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                    {row.customReleaseDate.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                    {row.consignedDate.toLocaleString()}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      border: '1px solid #dee2e6',
                      color:
                        row.timeDiff && row.timeDiff < 0 ? '#dc3545' : '#000',
                    }}
                  >
                    {row.timeDiff !== null ? row.timeDiff.toFixed(2) : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 分页控件 */}
          {filteredAndSorted.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '15px',
                padding: '10px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                <label style={{ fontSize: '14px' }}>Page Size:</label>
                <select
                  value={filters.pageSize}
                  onChange={(e) =>
                    handlePageSizeChange(tableKey, Number(e.target.value))
                  }
                  style={{
                    padding: '5px 10px',
                    borderRadius: '3px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
                <span style={{ fontSize: '14px', color: '#666' }}>
                  {startIndex + 1} to{' '}
                  {Math.min(endIndex, filteredAndSorted.length)} of{' '}
                  {filteredAndSorted.length}
                </span>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <button
                  onClick={() => handlePageChange(tableKey, 1)}
                  disabled={filters.currentPage === 1}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '3px',
                    border: '1px solid #ccc',
                    backgroundColor:
                      filters.currentPage === 1 ? '#e9ecef' : 'white',
                    cursor:
                      filters.currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                  }}
                >
                  ⏮
                </button>
                <button
                  onClick={() =>
                    handlePageChange(tableKey, filters.currentPage - 1)
                  }
                  disabled={filters.currentPage === 1}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '3px',
                    border: '1px solid #ccc',
                    backgroundColor:
                      filters.currentPage === 1 ? '#e9ecef' : 'white',
                    cursor:
                      filters.currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                  }}
                >
                  ◀
                </button>
                <span style={{ padding: '5px 10px', fontSize: '14px' }}>
                  Page {filters.currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    handlePageChange(tableKey, filters.currentPage + 1)
                  }
                  disabled={filters.currentPage === totalPages}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '3px',
                    border: '1px solid #ccc',
                    backgroundColor:
                      filters.currentPage === totalPages ? '#e9ecef' : 'white',
                    cursor:
                      filters.currentPage === totalPages
                        ? 'not-allowed'
                        : 'pointer',
                    fontSize: '14px',
                  }}
                >
                  ▶
                </button>
                <button
                  onClick={() => handlePageChange(tableKey, totalPages)}
                  disabled={filters.currentPage === totalPages}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '3px',
                    border: '1px solid #ccc',
                    backgroundColor:
                      filters.currentPage === totalPages ? '#e9ecef' : 'white',
                    cursor:
                      filters.currentPage === totalPages
                        ? 'not-allowed'
                        : 'pointer',
                    fontSize: '14px',
                  }}
                >
                  ⏭
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const totalRecords =
    filterByPortAndCategory(processedData.lessThanZero).length +
    filterByPortAndCategory(processedData.zeroTo12).length +
    filterByPortAndCategory(processedData.between12And24).length +
    filterByPortAndCategory(processedData.between24And48).length +
    filterByPortAndCategory(processedData.between48And72).length +
    filterByPortAndCategory(processedData.moreThan72).length;

  return (
    <div className="kpi-container">
      <header className="kpi-header">
        <h1>Warehouse KPI Analysis</h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginTop: '10px',
            flexWrap: 'wrap',
          }}
        >
          {/* T01/T86 筛选器 */}
          {availableCategories.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label
                style={{
                  fontWeight: 'bold',
                  color: '#dc3545',
                  fontSize: '16px',
                }}
              >
                Category:
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '2px solid #dc3545',
                  fontSize: '14px',
                  cursor: 'pointer',
                  minWidth: '100px',
                  fontWeight: 'bold',
                  backgroundColor:
                    selectedCategory !== 'ALL' ? '#fff5f5' : 'white',
                }}
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 端口筛选器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>Filter by Port:</label>
            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px',
                cursor: 'pointer',
                minWidth: '100px',
              }}
            >
              {availablePorts.map((port) => (
                <option key={port} value={port}>
                  {port}
                </option>
              ))}
            </select>
          </div>

          {/* 文件信息 */}
          {uploadedData && (
            <p style={{ color: '#666', fontSize: '14px', marginLeft: 'auto' }}>
              File: {uploadedData.fileName} | Total rows:{' '}
              {uploadedData.data?.length || 0}
              {selectedCategory !== 'ALL' && ` | Showing: ${selectedCategory}`}
            </p>
          )}
        </div>
      </header>

      {/* 统计卡片 */}
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '15px',
          marginBottom: '30px',
          marginTop: '20px',
        }}
      >
        {filterByPortAndCategory(processedData.lessThanZero).length > 0 && (
          <div className="kpi-card" style={{ borderTop: '4px solid #dc3545' }}>
            <h3 className="kpi-title">{'< 0 hours (Negative)'}</h3>
            <div className="kpi-value">
              {filterByPortAndCategory(processedData.lessThanZero).length}
            </div>
          </div>
        )}
        <div className="kpi-card" style={{ borderTop: '4px solid #28a745' }}>
          <h3 className="kpi-title">0-12 hours</h3>
          <div className="kpi-value">
            {filterByPortAndCategory(processedData.zeroTo12).length}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #17a2b8' }}>
          <h3 className="kpi-title">12-24 hours</h3>
          <div className="kpi-value">
            {filterByPortAndCategory(processedData.between12And24).length}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #ffc107' }}>
          <h3 className="kpi-title">24-48 hours</h3>
          <div className="kpi-value">
            {filterByPortAndCategory(processedData.between24And48).length}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #fd7e14' }}>
          <h3 className="kpi-title">48-72 hours</h3>
          <div className="kpi-value">
            {filterByPortAndCategory(processedData.between48And72).length}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #dc3545' }}>
          <h3 className="kpi-title">{'>'}72 hours</h3>
          <div className="kpi-value">
            {filterByPortAndCategory(processedData.moreThan72).length}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #6c757d' }}>
          <h3 className="kpi-title">Total Records</h3>
          <div className="kpi-value">{totalRecords}</div>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="tables-section">
        {renderTable(
          'Less than 0 hours (Negative)',
          processedData.lessThanZero,
          '#dc3545',
          'lessThanZero'
        )}
        {renderTable(
          '0-12 hours',
          processedData.zeroTo12,
          '#28a745',
          'zeroTo12'
        )}
        {renderTable(
          '12-24 hours',
          processedData.between12And24,
          '#17a2b8',
          'between12And24'
        )}
        {renderTable(
          '24-48 hours',
          processedData.between24And48,
          '#ffc107',
          'between24And48'
        )}
        {renderTable(
          '48-72 hours',
          processedData.between48And72,
          '#fd7e14',
          'between48And72'
        )}
        {renderTable(
          'More than 72 hours',
          processedData.moreThan72,
          '#dc3545',
          'moreThan72'
        )}
      </div>

      {totalRecords === 0 && uploadedData && (
        <div
          style={{
            textAlign: 'center',
            padding: '50px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            margin: '20px 0',
          }}
        >
          <p style={{ color: '#dc3545', fontSize: '16px', fontWeight: 'bold' }}>
            No data processed. Please check the console for debugging
            information.
          </p>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '10px' }}>
            Make sure your Excel file has:
            <br />
            1. Dates in column D that are after 2025-07-01
            <br />
            2. Valid dates in columns N (Custom Final Release Date) and O
            (Consigned to Final Mile Carrier Date)
            <br />
            3. Category (T01 or T86) in column A
          </p>
        </div>
      )}

      {!uploadedData && (
        <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
          <p>Please upload an Excel file to view the transit time analysis.</p>
        </div>
      )}
    </div>
  );
};

export default WarehouseKPI;
