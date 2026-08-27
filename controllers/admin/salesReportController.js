import moment from "moment"
import Order from "../../models/orderSchema.js"
import PDFDocument from 'pdfkit'
import ExcelJS from "exceljs"
export const salesReport = async (req, res) => {

    let { filter, startDate, endDate, page, limit } = req.query
    let start, end

    //FILTER DATES
    if (startDate && endDate) {
        start = moment(startDate).startOf('day')
        end = moment(endDate).endOf('day')
    } else if (filter === 'weekly') {
        start = moment().startOf('isoWeek')
        end = moment().endOf('isoWeek')
    } else if (filter === 'monthly') {
        start = moment().startOf('month')
        end = moment().endOf('month')
    } else if (filter === 'yearly') {
        start = moment().startOf('year')
        end = moment().endOf('year')
    } else {
        start = moment().startOf('day')
        end = moment().endOf('day')
    }

    page = parseInt(page) || 1
    limit = parseInt(limit) || 10
    let skip = (page - 1) * limit

    try {
        const orders = await Order.find({
            createdAt: {
                $gte: start.toDate(),
                $lt: end.toDate()
            }
        }).populate('userId')
            .skip(skip)
            .limit(limit)

        console.log(orders)

        let totalOrders = await Order.find({ createdAt: { $gte: start.toDate(), $lt: end.toDate() } }).countDocuments()
        let totalPages = Math.ceil(totalOrders / limit)

        let salesCount = 0;
        let totalAmount = 0;
        let discountedAmount = 0;

        orders.forEach(order => {
            salesCount += order.items.reduce((acc, item) => acc + item.quantity, 0);
            totalAmount += parseFloat(order.totalAmount || 0);

            discountedAmount += parseFloat(order.totalAmount || 0) - parseFloat(order.discount || 0);
        });
        return res.render('admin/salesReport', {
            orders, salesCount,
            totalAmount: Number(totalAmount),
            discountedAmount: Number(discountedAmount),
            totalPages, totalOrders, page, limit,
            filter: filter || '',
            startDate: startDate || '',
            endDate: endDate || ''
        })

    } catch (error) {
        console.log(`Sale report error : ${error.message}`)
        return res.status(500).json({ message: 'Sales report failure' })
    }
}


export const downloadPDFReport = async (req, res) => {
    try {
        const { filter, startDate, endDate } = req.query;
        let start, end;

        if (startDate && endDate) {
            start = moment(startDate).startOf('day');
            end = moment(endDate).endOf('day');
        } else if (filter === 'weekly') {
            start = moment().startOf('isoWeek');
            end = moment().endOf('isoWeek');
        } else if (filter === 'monthly') {
            start = moment().startOf('month');
            end = moment().endOf('month');
        } else if (filter === 'yearly') {
            start = moment().startOf('year');
            end = moment().endOf('year');
        } else {
            start = moment().startOf('day');
            end = moment().endOf('day');
        }

        const orders = await Order.find({
            createdAt: {
                $gte: start.toDate(),
                $lt: end.toDate()
            }
        }).populate('userId');

        let salesCount = 0;
        let totalAmount = 0;
        let discountedAmount = 0;

        orders.forEach(order => {
            salesCount += order.items.reduce((acc, item) => acc + item.quantity, 0);
            totalAmount += parseFloat(order.totalAmount || 0);
            discountedAmount += parseFloat(order.totalAmount || 0) - parseFloat(order.discount || 0);
        });

        const doc = new PDFDocument({
            size: 'A4',
            margin: 50
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="read_grow_sales_report.pdf"');

        doc.pipe(res);

        // Header
        doc.font('Helvetica-Bold')
           .fontSize(20)
           .text('Read & Grow Sales Report', { align: 'center' });
        
        doc.moveDown(0.5);
        doc.font('Helvetica')
           .fontSize(12)
           .text(`Period: ${start.format('DD/MM/YYYY')} - ${end.format('DD/MM/YYYY')}`, { align: 'center' });
        
        doc.moveDown(1.5);

        // Summary Section
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .text('Summary', { align: 'left' });
        
        doc.moveDown(0.5);
        doc.font('Helvetica')
           .fontSize(12);
        
        const summaryData = [
            { label: 'Total Items Sold:', value: salesCount.toString() },
            { label: 'Total After Discount:', value: `Rs. ${discountedAmount.toFixed(2)}` },
            { label: 'Total Sales Amount:', value: `Rs. ${totalAmount.toFixed(2)}` },
        ];

        summaryData.forEach((item, index) => {
            doc.text(`${item.label} ${item.value}`, {
                align: 'left',
                continued: false
            });
            if (index < summaryData.length - 1) doc.moveDown(0.3);
        });

        doc.moveDown(1.5);

        // Orders Table Header
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .text('Order Details', { align: 'left' });
        
        doc.moveDown(0.5);

        // Table Header
        const tableTop = doc.y;
        const colWidths = [70, 80, 70, 70, 70, 70, 70];
        const headers = ['Date', 'OrderID', 'Customer', 'Status', 'Payment', 'Qty', 'Total'];

        doc.font('Helvetica-Bold')
           .fontSize(10);
        
        headers.forEach((header, i) => {
            doc.text(header, 50 + (i * colWidths[i]), tableTop, {
                width: colWidths[i],
                align: 'left'
            });
        });

        // Draw header underline
        doc.moveTo(50, tableTop + 15)
           .lineTo(550, tableTop + 15)
           .stroke();

        // Table Rows
        doc.font('Helvetica')
           .fontSize(9);
        
        let currentY = tableTop + 25;
        orders.forEach((order, index) => {
            const rowData = [
                moment(order.createdAt).format('DD/MM/YYYY'),
                order.orderId.slice(-6), // Using _id as Order Id
                order.userId?.username || 'N/A',
                order.status || 'N/A', // Assuming status might exist, fallback to 'N/A'
                order.payment || 'N/A', // Assuming paymentMethod, fallback to 'N/A'
                order.items.reduce((acc, item) => acc + item.quantity, 0).toString(),
                `Rs. ${parseFloat(order.totalAmount || 0).toFixed(2)}`
            ];

            rowData.forEach((data, i) => {
                doc.text(data, 50 + (i * colWidths[i]), currentY, {
                    width: colWidths[i],
                    align: 'left'
                });
            });

            currentY += 30;
            
            // Add horizontal line after each row
            doc.moveTo(50, currentY - 5)
               .lineTo(550, currentY - 5)
               .stroke();

            // Handle page overflow
            if (currentY > 700 && index < orders.length - 1) {
                doc.addPage();
                currentY = 50;
                doc.font('Helvetica-Bold')
                   .fontSize(10);
                headers.forEach((header, i) => {
                    doc.text(header, 50 + (i * colWidths[i]), currentY, {
                        width: colWidths[i],
                        align: 'left'
                    });
                });
                doc.moveTo(50, currentY + 15)
                   .lineTo(550, currentY + 15)
                   .stroke();
                currentY += 25;
                doc.font('Helvetica')
                   .fontSize(9);
            }
        });

        // Footer
        doc.moveDown(2);
        doc.font('Helvetica-Oblique')
           .fontSize(10)
           .text('Generated by Read & Grow', { align: 'center' });
        doc.text(`Date: ${moment().format('DD/MM/YYYY HH:mm')}`, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error(`PDF report generation failed: ${error.message}`);
        res.status(500).send("PDF report generation failed");
    }
};


//     try {
//         const { filter, startDate, endDate } = req.query
//         let start, end

//         if (startDate && endDate) {
//             start = moment(startDate).startOf('day')
//             end = moment(endDate).endOf('day')
//         } else if (filter === 'weekly') {
//             start = moment().startOf('isoWeek')
//             end = moment().endOf('isoWeek')
//         } else if (filter === 'monthly') {
//             start = moment().startOf('month')
//             end = moment().endOf('month')
//         } else if (filter === 'yearly') {
//             start = moment().startOf('year')
//             end = moment().endOf('year')
//         } else {
//             start = moment().startOf('day')
//             end = moment().endOf('day')
//         }

//         const orders = await Order.find({
//             createdAt: {
//                 $gte: start.toDate(),
//                 $lt: end.toDate()
//             }
//         }).populate('userId')


//         let salesCount = 0;
//         let totalAmount = 0;
//         let discountedAmount = 0;

//         orders.forEach(order => {
//             salesCount += order.items.reduce((acc, item) => acc + item.quantity, 0); // TOTAL ITEMS SOLD
//             totalAmount += parseFloat(order.totalAmount || 0);//TOTAL AMOUNT
//             discountedAmount += parseFloat(order.totalAmount || 0) - parseFloat(order.discount || 0);//TOTAL DISCOUNT

//         });

//         //RENDER PDF PAGE
//         return res.render('admin/report-pdf', {
//             orders, salesCount,
//             totalAmount: Number(totalAmount),
//             discountedAmount: Number(discountedAmount)
//         }, (err, html) => {
//             if (err) {
//                 console.log(err.message)
//                 return res.status(500).send("Error rendering PDF");
//             }
//             pdf.create(html).toStream((err, stream) => {
//                 if (err) {
//                     console.log(err.message)
//                     return res.status(500).send("Error rendering PDF");
//                 }
//                 res.setHeader('Content-Type', 'application/pdf');
//                 res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
//                 stream.pipe(res);
//             });
//         });


//     } catch (error) {
//         console.log(`Pdf report download failed ${error.message}`)
//         res.status(500).send("Pdf report generating failed")
//     }
// }




//pupueteer

// export const downloadPDFReport = async (req, res) => {
//     try {
//         const { filter, startDate, endDate } = req.query;
//         let start, end;

//         if (startDate && endDate) {
//             start = moment(startDate).startOf('day');
//             end = moment(endDate).endOf('day');
//         } else if (filter === 'weekly') {
//             start = moment().startOf('isoWeek');
//             end = moment().endOf('isoWeek');
//         } else if (filter === 'monthly') {
//             start = moment().startOf('month');
//             end = moment().endOf('month');
//         } else if (filter === 'yearly') {
//             start = moment().startOf('year');
//             end = moment().endOf('year');
//         } else {
//             start = moment().startOf('day');
//             end = moment().endOf('day');
//         }

//         const orders = await Order.find({
//             createdAt: {
//                 $gte: start.toDate(),
//                 $lt: end.toDate()
//             }
//         }).populate('userId');

//         let salesCount = 0;
//         let totalAmount = 0;
//         let discountedAmount = 0;

//         orders.forEach(order => {
//             salesCount += order.items.reduce((acc, item) => acc + item.quantity, 0);
//             totalAmount += parseFloat(order.totalAmount || 0);
//             discountedAmount += parseFloat(order.totalAmount || 0) - parseFloat(order.discount || 0);
//         });

//         const templatePath = path.join(process.cwd(), 'views', 'admin', 'report-pdf.ejs');

//         const html = await ejs.renderFile(templatePath, {
//             orders,
//             salesCount,
//             totalAmount: Number(totalAmount),
//             discountedAmount: Number(discountedAmount)
//         });

//         fs.writeFileSync('rendered.html', html);

//         const browser = await puppeteer.launch({
//             headless: 'new',
//             args: ['--no-sandbox', '--disable-setuid-sandbox'],
//             timeout: 60000
//         });

//         const page = await browser.newPage();
//         await page.setContent(html, {
//             waitUntil: 'networkidle0',
//             timeout: 30000
//         });

//         await page.evaluateHandle('document.fonts.ready');

//         const pdfBuffer = await page.pdf({
//             format: 'A4',
//             printBackground: true,
//             margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
//         });

//         fs.writeFileSync('generated.pdf', pdfBuffer);

//         await browser.close();

//         res.setHeader('Content-Type', 'application/pdf');
//         res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
//         res.setHeader('Content-Length', pdfBuffer.length);
//         res.status(200).end(pdfBuffer, 'binary');
//     } catch (error) {
//         console.error('PDF report download failed:', error.message);
//         res.status(500).send('PDF report generation failed');
//     }
// };


export const downloadExcelReport = async (req, res) => {
    try {
        const { filter, startDate, endDate } = req.query;
        let start, end;

        // Set the date ranges based on the filter or custom date range
        if (startDate && endDate) {
            start = moment(startDate).startOf('day');
            end = moment(endDate).endOf('day');
        } else if (filter == 'weekly') {
            start = moment().startOf('isoWeek');
            end = moment().endOf('isoWeek');
        } else if (filter == 'monthly') {
            start = moment().startOf('month');
            end = moment().endOf('month');
        } else if (filter == 'yearly') {
            start = moment().startOf('year');
            end = moment().endOf('year');
        } else {
            start = moment().startOf('day');
            end = moment().endOf('day');
        }

        
        const orders = await Order.find({
            createdAt: {
                $gte: start.toDate(),
                $lte: end.toDate()
            }
        }).populate('userId')
 
        let salesCount = 0;
        let totalAmount = 0;
        let discountedAmount = 0;

        orders.forEach(order => {
            salesCount += order.items.reduce((acc, item) => acc + item.quantity, 0); //tTOTAL ITEMS SOLD
            totalAmount += parseFloat(order.totalAmount || 0);//TOTAL AMOUNT
            discountedAmount += parseFloat(order.totalAmount || 0) - parseFloat(order.discount || 0);//DISCOUNT PRICE
        });


        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        //SETTING ROWS
        worksheet.addRow(['Sales Report']);
        worksheet.addRow([]); // Empty row for spacing
        worksheet.addRow(['Sales Count:', salesCount]);
        worksheet.addRow(['Total Amount:', totalAmount]);
        worksheet.addRow(['Total Discount:', discountedAmount]);
        worksheet.addRow([]); // Empty row for spacing

        // Add the header row for the table — 8 columns now, matching the 8 values pushed
        // below. This used to be 7 headers for 8 values (an extra order.subTotal snuck in
        // before order.totalAmount with no header of its own), which shifted every column
        // after "Quantity" one to the left and left the actual total in an unlabeled column.
        worksheet.addRow(['Date', 'Order ID', 'Customer', 'Status', 'Payment Method', 'Quantity', 'Subtotal', 'Total']);

        // Add data rows
        orders.forEach(order => {
            let itemQty = 0
            order.items.forEach(item => {
                itemQty += item.quantity
            });
                worksheet.addRow([
                    order.createdAt.toISOString().split('T')[0],  // Format date as YYYY-MM-DD
                    order.orderId,
                    order.userId?.username,
                    order.status,
                    order.payment,
                    itemQty,
                    order.subTotal,
                    order.totalAmount
                ]);
        });

        // Set headers for the Excel file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="sales_report.xlsx"');

        // Write the workbook to the response stream
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error generating Excel report:', error);
        res.status(500).send('Error generating Excel report');
    }
};

