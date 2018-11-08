alter table assembly add column `ncbi_assembly_acc` varchar(128) default NULL after ncbi_version;

alter table chrom add column `ncbi_chrom_acc` char(64) default NULL after chrom_type;

alter table collaboration add column open_to_public char(1) NOT NULL default '';

