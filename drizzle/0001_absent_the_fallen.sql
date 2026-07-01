CREATE TABLE `despesaItens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`despesaId` varchar(36) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`quantidade` decimal(12,3) NOT NULL DEFAULT '1.000',
	`valorUnitario` decimal(12,2) NOT NULL DEFAULT '0.00',
	`valorTotal` decimal(12,2) NOT NULL DEFAULT '0.00',
	CONSTRAINT `despesaItens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `despesas` (
	`id` varchar(36) NOT NULL,
	`userOpenId` varchar(64),
	`tipoPessoa` enum('PF','PJ') NOT NULL,
	`clienteId` varchar(64),
	`fornecedorNome` varchar(255) NOT NULL,
	`fornecedorCnpj` varchar(18),
	`dataEmissao` varchar(10),
	`valorTotal` decimal(12,2) NOT NULL,
	`imageUrl` text NOT NULL,
	`imageStorageKey` varchar(255),
	`conferidoIR` int NOT NULL DEFAULT 0,
	`dadosExtraidosJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `despesas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `licenseActivations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`licenseId` int NOT NULL,
	`subjectKey` varchar(96) NOT NULL,
	`activatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `licenseActivations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`codeHint` varchar(16) NOT NULL,
	`plan` enum('pro','annual') NOT NULL,
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`maxActivations` int NOT NULL DEFAULT 1,
	`usedCount` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`createdByOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `licenses_id` PRIMARY KEY(`id`),
	CONSTRAINT `licenses_codeHash_unique` UNIQUE(`codeHash`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectKey` varchar(96) NOT NULL,
	`plan` enum('free','pro','annual') NOT NULL DEFAULT 'free',
	`status` enum('active','canceled','expired') NOT NULL DEFAULT 'active',
	`store` enum('manual','revenuecat','googleplay') NOT NULL DEFAULT 'manual',
	`externalCustomerId` varchar(128),
	`externalSubscriptionId` varchar(128),
	`expiresAt` timestamp,
	`subscribedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_subjectKey_unique` UNIQUE(`subjectKey`)
);
