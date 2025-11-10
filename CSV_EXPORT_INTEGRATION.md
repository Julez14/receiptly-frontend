# CSV Export Endpoint - Frontend Integration Guide

## Endpoint Details

**URL:** `GET /receipts/:id/export/csv`

**Authentication:** Required - Supabase access token

**Purpose:** Export a single receipt as a downloadable CSV file

## How to Use

### 1. Basic Implementation

```javascript
async function downloadReceiptCSV(receiptId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(
    `http://localhost:8080/receipts/${receiptId}/export/csv`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download CSV: ${response.statusText}`);
  }

  // Trigger browser download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt_${receiptId}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
```

### 2. Usage in a Component

```javascript
// Add a download button to your receipt component
<button onClick={() => downloadReceiptCSV(receipt.id)}>Download CSV</button>
```

### 3. Error Handling

The endpoint returns these status codes:

- **200** - Success (CSV file)
- **400** - Invalid receipt ID format
- **401** - Missing or invalid authentication token
- **404** - Receipt not found or user doesn't own it
- **500** - Server error

### 4. CSV Format

The CSV will contain:

- Receipt metadata (Merchant, Purchase Date, Total, Currency, Category, Receipt ID)
- Blank line separator
- Items section with columns: Name, Quantity, Price

### 5. Important Notes

- User can only download receipts they own
- The endpoint enforces ownership via JWT token
- File is automatically named `receipt_<id>.csv`
- All prices are formatted to 2 decimal places
- Dates are in YYYY-MM-DD format

### 6. Production URL

Replace `http://localhost:8080` with your production API URL when deploying.

### 7. TypeScript Example

```typescript
const downloadReceiptCSV = async (receiptId: string): Promise<void> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/receipts/${receiptId}/export/csv`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to download CSV");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt_${receiptId}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
```
