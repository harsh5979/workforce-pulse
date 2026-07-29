# Workforce Pulse — Metric & Analytical Methodology

This document outlines the mathematical models, formulas, assumptions, and algorithmic derivations implemented across the **Workforce Pulse** analytical suite. Every numerical insight presented in the user interface is generated deterministically using these verified procedures.

---

## 1. Headline Metric: Monthly Recoverable Hours

### Formula
$$\text{Hours Recoverable / Month} = \sum_{i=1}^{n} \text{RepetitiveHours}_i \times \left( \frac{30}{\text{DatasetDays}} \right)$$

### Derivation & Rationale
1. **Activity Selection**: All activity log records where `is_repetitive = true` (after Boolean normalization) are summed per employee and category.
2. **Temporal Scaling**: Since raw activity logs may span varying operational windows (e.g., a 28-day / 4-week window), the observed total is scaled to a standard **30-day calendar month**.
3. **Signal Clarity**: Blank durations (`""`) and negative durations (`< 0`) are excluded or clamped during initial ingestion to prevent deflationary or inflationary bias in the aggregate recoverable total.

---

## 2. Headline Metric: Financial Opportunity (INR Recoverable / Month)

To project accurate financial recovery figures across an organizational structure with mixed salary formats (Annual Salary, Hourly Wage, Lakhs Per Annum), compensation must be normalized to a standard **Hourly Wage in INR**.

### Step A: Annual INR Normalization
- **Annual INR**: $\text{Annual INR} = \text{Raw Value}$
- **Hourly INR**: $\text{Annual INR} = \text{Hourly Wage} \times 8\text{ hours} \times 260\text{ working days}$
- **LPA (Lakhs Per Annum)**: $\text{Annual INR} = \text{LPA} \times 100,000$

### Step B: Employee Hourly Wage Calculation
$$\text{HourlyRate}_{INR} = \frac{\text{CompAnnual}_{INR}}{260 \times \text{WorkingHoursPerDay}}$$
*(Default working hours per day is assumed as `8` if unspecified or malformed in HRMS metadata).*

### Step C: Monthly INR Opportunity
$$\text{Financial Opportunity / Mo} = \sum_{j=1}^{m} \left( \text{MonthlyRepetitiveHours}_j \times \text{HourlyRate}_{INR, j} \right)$$

---

## 3. Automation Priority Score (Composite Ranking)

To guide strategic investment in workflow automation, task categories are evaluated across three distinct operational dimensions: volume, repetitive ratio, and employee reach.

### Scoring Formula
$$\text{Score} = (0.40 \times \text{Volume}_{norm}) + (0.40 \times \text{RepetitiveShare}) + (0.20 \times \text{Reach}_{norm})$$

| Component | Weight | Calculation | Business Justification |
| :--- | :---: | :--- | :--- |
| **Volume ($Volume_{norm}$)** | **40%** | $\frac{\text{CategoryTotalHours}}{\max(\text{AllCategoryHours})}$ | Prioritizes processes consuming heavy aggregate company time. |
| **Repetitive Share** | **40%** | $\frac{\text{CategoryRepetitiveHours}}{\text{CategoryTotalHours}}$ | Identifies deterministic tasks best suited for programmatic or AI automation. |
| **Reach ($Reach_{norm}$)** | **20%** | $\frac{\text{EmployeesInCategory}}{\text{TotalActiveEmployees}}$ | Rewards solutions that alleviate friction across a broader employee base. |

### Visual Categorization (Score Labels)
- **Very High Priority**: $\text{Score} \ge 0.700$ (Immediate target for RPA/AI implementation)
- **High Priority**: $0.500 \le \text{Score} < 0.700$ (Secondary roadmap candidate)
- **Medium Priority**: $0.300 \le \text{Score} < 0.500$ (Process re-engineering recommended)
- **Low Priority**: $\text{Score} < 0.300$ (Monitor only)

---

## 4. Automated Anomaly Detection (Z-Score & Threshold Alarming)

Workforce Pulse runs background statistical audits on employee task cohorts to identify behavioral outliers and risk zones without human bias.

### A. Employee Workload Outliers (Z-Score Algorithm)
For each department $d$ and operational week $w$, the mean ($\mu$) and standard deviation ($\sigma$) of logged hours are computed:
$$\text{Z-Score}_i = \frac{\text{Hours}_i - \mu_{d,w}}{\sigma_{d,w}}$$
- **High Volume Spike ($\text{Z} > +2.0\sigma$)**: Flags employee risk of burnout or manual work bottleneck.
- **Low Volume Anomaly ($\text{Z} < -2.0\sigma$)**: Flags potential logging attrition or synchronization blockage.

### B. High Repetitive Department Threshold
- Any corporate department logging $>80\%$ of its total time as repetitive tasks generates a system alert, identifying an architectural workflow deficit requiring procedural automation.
