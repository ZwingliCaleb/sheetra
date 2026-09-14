import os

def create_valid_pdf_score(filename):
    pdf_content = (
        b"%PDF-1.4\n"
        b"1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj\n"
        b"2 0 obj <</Type/Pages/Count 1/Kids[3 0 R]>> endobj\n"
        b"3 0 obj <</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>> endobj\n"
        b"4 0 obj <</Type/Font/Subtype/Type1/BaseFont/Helvetica>> endobj\n"
        b"5 0 obj <</Length 650>> stream\n"
        b"q\n"
        b"% Draw Title & Composer\n"
        b"BT /F1 20 Tf 220 730 TD (Gloria In Excelsis Deo) Tj ET\n"
        b"BT /F1 12 Tf 450 710 TD (Traditional Hymn) Tj ET\n"
        b"\n"
        b"% Draw Staff System 1 (5 parallel lines)\n"
        b"1 w 0 0 0 RG\n"
        b"50 600 m 550 600 l S\n"
        b"50 610 m 550 610 l S\n"
        b"50 620 m 550 620 l S\n"
        b"50 630 m 550 630 l S\n"
        b"50 640 m 550 640 l S\n"
        b"\n"
        b"% Measure Bar Lines\n"
        b"50 600 m 50 640 l S\n"
        b"180 600 m 180 640 l S\n"
        b"310 600 m 310 640 l S\n"
        b"440 600 m 440 640 l S\n"
        b"550 600 m 550 640 l S\n"
        b"\n"
        b"% Draw Lyrics aligned under staves\n"
        b"BT /F1 12 Tf 80 575 TD (Glo-) Tj ET\n"
        b"BT /F1 12 Tf 130 575 TD (ri-) Tj ET\n"
        b"BT /F1 12 Tf 210 575 TD (a) Tj ET\n"
        b"BT /F1 12 Tf 260 575 TD (in) Tj ET\n"
        b"BT /F1 12 Tf 340 575 TD (ex-) Tj ET\n"
        b"BT /F1 12 Tf 390 575 TD (cel-) Tj ET\n"
        b"BT /F1 12 Tf 470 575 TD (sis) Tj ET\n"
        b"BT /F1 12 Tf 510 575 TD (De-o!) Tj ET\n"
        b"Q\n"
        b"endstream\n"
        b"endobj\n"
        b"xref\n"
        b"0 6\n"
        b"0000000000 65535 f\n"
        b"0000000009 00000 n\n"
        b"0000000056 00000 n\n"
        b"00000000111 00000 n\n"
        b"0000000212 00000 n\n"
        b"0000000277 00000 n\n"
        b"trailer <</Size 6/Root 1 0 R>>\n"
        b"startxref\n"
        b"980\n"
        b"%%EOF\n"
    )

    with open(filename, "wb") as f:
        f.write(pdf_content)
    print(f"Created PDF score at: {filename}")

if __name__ == "__main__":
    out_file = os.path.join(os.path.dirname(__file__), "uploads", "gloria_score.pdf")
    create_valid_pdf_score(out_file)
