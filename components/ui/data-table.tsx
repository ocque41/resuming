"use client";

import * as React from "react";
import { ColumnDef, getCoreRowModel } from "@tanstack/react-table";
import { useReactTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogBody } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from "@/components/ui/comboboxes";

type Payment = {
  id: string;
  amount: number;
  status: "pending" | "processing" | "success" | "failed";
  email: string;
  company: string;
  jobTitle: string;
  requirements: string;
};

export const payments: Payment[] = [
  {
    id: "728ed52f",
    amount: 100,
    status: "pending",
    email: "m@example.com",
    company: "Unknown",
    jobTitle: "Unknown",
    requirements: "Unknown",
  },
  {
    id: "123abc",
    amount: 0,
    status: "success",
    email: "hr@company.com",
    company: "Tech Corp",
    jobTitle: "Software Engineer",
    requirements: "JavaScript, React, Node.js",
  },
  {
    id: "489e1d42",
    amount: 125,
    status: "processing",
    email: "example@gmail.com",
    company: "Unknown",
    jobTitle: "Unknown",
    requirements: "Unknown",
  },
  // Add more payment objects as needed
];

const jobColumns: ColumnDef<Payment>[] = [
  {
    accessorKey: "company",
    header: "Company",
  },
  {
    accessorKey: "jobTitle",
    header: "Job Title",
  },
  {
    accessorKey: "requirements",
    header: "Essential Requirements",
  },
  {
    id: "apply",
    header: "Apply",
    cell: ({ row }) => (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Apply</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for {row.original.jobTitle}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Combobox
              value={payments[0].id}
              onChange={(cv: string) => console.log(`Selected CV: ${cv}`)}
            >
              <ComboboxInput
                aria-label="Select CV"
                displayValue={(cv) => cv as string}
              />
              <ComboboxOptions anchor="bottom" className="border empty:invisible">
                {payments.map((payment) => (
                  <ComboboxOption key={payment.id} value={payment.id} className="data-[focus]:bg-blue-100">
                    {payment.id}
                  </ComboboxOption>
                ))}
              </ComboboxOptions>
            </Combobox>
            <textarea
              className="w-full mt-4 p-2 border rounded"
              placeholder="Write your cover letter here..."
            />
            <Button className="mt-2" variant="outline">
              AI Write Cover Letter
            </Button>
            <Button className="mt-2" variant="default">
              Send
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    ),
  },
];

const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "amount",
    header: "Amount",
  },
  {
    accessorKey: "status",
    header: "Status",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
];

export function DataTable() {
  const table = useReactTable({
    data: payments,
    columns: jobColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-4">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : typeof header.column.columnDef.header === "function"
                    ? header.column.columnDef.header(header.getContext())
                    : header.column.columnDef.header}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {typeof cell.column.columnDef.cell === "function"
                    ? cell.column.columnDef.cell(cell.getContext())
                    : cell.column.columnDef.cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
