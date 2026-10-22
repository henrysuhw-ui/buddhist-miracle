# 範本 · Template

複製以下內容為 `cases/YYYY-地區-流水號-slug.md`，逐項填寫。刪去用不到的欄位與註解。

```markdown
---
id: "0007"
title: 手術前一夜，她夢見白衣人
lang: zh-Hant          # zh-Hant | zh-Hans | en
subject: 陳女士（化名）  # 可省略；用化名時註明
event_date: 2023-11
date_precision: month  # day | month | year | approx
place:
  country: HK
  city: 香港
  detail: 公立醫院
tradition: 漢傳         # 漢傳 | 南傳 | 藏傳 | 跨傳承
theme: [疾病, 夢兆]
evidence_tier: A       # A 自述 | B 口述記
attribution: named     # named | pseudonymous | anonymous
sources:
  - type: youtube      # youtube | article | audio | book | interview | other
    title: 手術前的一夜
    url: https://youtu.be/xxxx?t=754
    timestamp: "12:34"
    published: 2024-03-02
    retrieved: 2026-10-22
    archived: ""       # Wayback 連結；留空則 CI 提示
    quote: 我當時只係一路念，念到唔知幾時睡着。
reviewed_by: ["@your-handle"]
reviewed_at: 2026-10-22
status: published      # published | example | pending
---

> 〔格式範例，非真實案例〕← 正式條目請刪去此行

## 一句話
手術前一夜，她夢見白衣人立在床邊。

## 情境
二〇二三年十一月，香港，五十餘歲，乳癌第三期，公立醫院。

## 經過
她說術前一夜念佛至睡着，夢中見白衣人立於床邊，未言語。醒後心中安定，翌日入手術室。
術後病理報告顯示腫瘤較預期為小。「我當時只係一路念，念到唔知幾時睡着。」

## 當事人的理解
她認為那是觀音菩薩示現，令她不再恐懼。

出處：二〇二四年三月二日，YouTube「某某頻道」〈手術前的一夜〉，12:34。
https://youtu.be/xxxx?t=754 ｜ 存檔：https://web.archive.org/web/xxxx
編者未親見，未見病歷。
```

## 書本來源

```yaml
sources:
  - type: book
    title: 書名
    author: 作者
    publisher: 出版社
    year: 2020
    isbn: "9789570000000"
    page: "88-90"
    retrieved: 2026-10-22
```

## 口述記（B 級）

須為**已公開發表**的記錄，例如紀錄片、播客、報刊訪談：

```yaml
evidence_tier: B
attribution: named
sources:
  - type: interview
    title: 訪談紀錄
    url: https://example.org/interview
    timestamp: "05:20"
    published: 2022-06-01
    retrieved: 2026-10-22
```

出處行須加一句說明記錄者：`某某紀錄片，導演某某。`

## 附錄（姑存）

不合格者放 `appendix/`，`status: pending`，並加 `pending_reason`：

```yaml
status: pending
pending_reason: 僅見親友轉述，未找到當事人本人陳述
```
