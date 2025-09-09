-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `avatarSeed` VARCHAR(191) NULL,
    `categories` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Circle` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `isPrivate` BOOLEAN NOT NULL DEFAULT false,
    `quietHours` JSON NULL,
    `allowsMinors` BOOLEAN NOT NULL DEFAULT true,
    `demurrageRate` DOUBLE NOT NULL DEFAULT 0.0,
    `categories` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Circle_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Membership` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `role` ENUM('MEMBER', 'MODERATOR', 'OWNER', 'ADMIN') NOT NULL DEFAULT 'MEMBER',
    `balanceCredits` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Membership_userId_idx`(`userId`),
    INDEX `Membership_circleId_idx`(`circleId`),
    UNIQUE INDEX `Membership_userId_circleId_key`(`userId`, `circleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CircleInvite` (
    `id` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `inviterId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `usedById` VARCHAR(191) NULL,
    `usedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CircleInvite_token_key`(`token`),
    INDEX `CircleInvite_circleId_idx`(`circleId`),
    INDEX `CircleInvite_token_idx`(`token`),
    INDEX `CircleInvite_inviterId_idx`(`inviterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JoinRequest` (
    `id` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `JoinRequest_circleId_idx`(`circleId`),
    INDEX `JoinRequest_userId_idx`(`userId`),
    INDEX `JoinRequest_status_idx`(`status`),
    UNIQUE INDEX `JoinRequest_userId_circleId_key`(`userId`, `circleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Request` (
    `id` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('OPEN', 'BOOKED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `category` ENUM('HOUSEHOLD_TASKS', 'YARD_WORK', 'PET_CARE', 'CHILD_CARE', 'ELDER_CARE', 'TRANSPORTATION', 'TECH_SUPPORT', 'HOME_REPAIR', 'MOVING_HELP', 'ERRANDS', 'COOKING', 'TUTORING', 'CREATIVE_PROJECTS', 'EVENT_HELP', 'OTHER') NOT NULL,
    `photoBase64` LONGTEXT NULL,
    `effortLevel` INTEGER NOT NULL DEFAULT 3,
    `creditsOffered` INTEGER NOT NULL,
    `tier` ENUM('BASIC', 'PRIORITY', 'GUARANTEED') NOT NULL DEFAULT 'BASIC',
    `timeWindowStart` DATETIME(3) NULL,
    `timeWindowEnd` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `locationRadius` DOUBLE NULL,
    `address` VARCHAR(500) NULL,
    `city` VARCHAR(191) NULL,
    `equipmentNeeded` JSON NULL,
    `specialRequirements` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Request_circleId_idx`(`circleId`),
    INDEX `Request_userId_idx`(`userId`),
    INDEX `Request_status_idx`(`status`),
    INDEX `Request_category_idx`(`category`),
    INDEX `Request_tier_idx`(`tier`),
    INDEX `Request_city_idx`(`city`),
    INDEX `Request_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Offer` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `helperId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
    `message` TEXT NULL,
    `proposedStartAt` DATETIME(3) NULL,
    `estimatedHours` DOUBLE NULL,
    `helperPhone` VARCHAR(50) NULL,
    `helperEmail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Offer_requestId_idx`(`requestId`),
    INDEX `Offer_helperId_idx`(`helperId`),
    INDEX `Offer_status_idx`(`status`),
    UNIQUE INDEX `Offer_requestId_helperId_key`(`requestId`, `helperId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Slot` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NOT NULL,
    `location` VARCHAR(191) NULL,
    `status` ENUM('OPEN', 'BOOKED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `title` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `category` ENUM('HOUSEHOLD_TASKS', 'YARD_WORK', 'PET_CARE', 'CHILD_CARE', 'ELDER_CARE', 'TRANSPORTATION', 'TECH_SUPPORT', 'HOME_REPAIR', 'MOVING_HELP', 'ERRANDS', 'COOKING', 'TUTORING', 'CREATIVE_PROJECTS', 'EVENT_HELP', 'OTHER') NULL,
    `pricePerMinute` INTEGER NOT NULL DEFAULT 1,
    `minDuration` INTEGER NOT NULL DEFAULT 5,
    `maxDuration` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Slot_requestId_idx`(`requestId`),
    INDEX `Slot_providerId_idx`(`providerId`),
    INDEX `Slot_circleId_idx`(`circleId`),
    INDEX `Slot_status_idx`(`status`),
    INDEX `Slot_start_end_idx`(`start`, `end`),
    INDEX `Slot_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Booking` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NULL,
    `slotId` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `bookerId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `duration` INTEGER NULL,
    `totalCredits` INTEGER NULL,
    `actualStart` DATETIME(3) NULL,
    `actualEnd` DATETIME(3) NULL,
    `bookerNotes` TEXT NULL,
    `providerNotes` TEXT NULL,
    `completionNotes` TEXT NULL,
    `completionPhotoBase64` LONGTEXT NULL,
    `bookerThanks` TEXT NULL,
    `providerThanks` TEXT NULL,
    `checkinLatitude` DOUBLE NULL,
    `checkinLongitude` DOUBLE NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Booking_requestId_idx`(`requestId`),
    INDEX `Booking_slotId_idx`(`slotId`),
    INDEX `Booking_providerId_idx`(`providerId`),
    INDEX `Booking_bookerId_idx`(`bookerId`),
    INDEX `Booking_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LedgerEntry` (
    `id` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NULL,
    `fromUserId` VARCHAR(191) NULL,
    `toUserId` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `type` ENUM('CREDIT', 'DEBIT', 'FEE', 'ADJUSTMENT') NOT NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LedgerEntry_circleId_idx`(`circleId`),
    INDEX `LedgerEntry_bookingId_idx`(`bookingId`),
    INDEX `LedgerEntry_fromUserId_idx`(`fromUserId`),
    INDEX `LedgerEntry_toUserId_idx`(`toUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditLot` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `remaining` INTEGER NOT NULL,
    `source` ENUM('EARNED', 'PURCHASED', 'BONUS', 'GRANT', 'LOAN') NOT NULL,
    `tier` ENUM('BASIC', 'PRIORITY', 'GUARANTEED') NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreditLot_userId_idx`(`userId`),
    INDEX `CreditLot_circleId_idx`(`circleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeeRule` (
    `id` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `percentBps` INTEGER NULL,
    `flatFee` INTEGER NULL,
    `appliesTo` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `FeeRule_circleId_idx`(`circleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'PAST_DUE', 'CANCELED') NOT NULL DEFAULT 'ACTIVE',
    `plan` VARCHAR(191) NOT NULL,
    `currentPeriodEnd` DATETIME(3) NULL,
    `stripeCustomerId` VARCHAR(191) NULL,
    `stripeSubId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subscription_userId_idx`(`userId`),
    INDEX `Subscription_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `bio` VARCHAR(191) NULL,
    `skills` JSON NULL,
    `hourlyRate` INTEGER NULL,

    UNIQUE INDEX `ProProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Treasury` (
    `id` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `balanceCredits` INTEGER NOT NULL DEFAULT 0,
    `reservedCredits` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Treasury_circleId_key`(`circleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Loan` (
    `id` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `borrowerId` VARCHAR(191) NOT NULL,
    `principal` INTEGER NOT NULL,
    `remaining` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'REPAID', 'DEFAULTED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Loan_circleId_idx`(`circleId`),
    INDEX `Loan_borrowerId_idx`(`borrowerId`),
    INDEX `Loan_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InsurancePool` (
    `id` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `premiumBps` INTEGER NULL,

    UNIQUE INDEX `InsurancePool_circleId_key`(`circleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InsuranceClaim` (
    `id` VARCHAR(191) NOT NULL,
    `poolId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `status` ENUM('SUBMITTED', 'APPROVED', 'DENIED', 'PAID') NOT NULL DEFAULT 'SUBMITTED',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InsuranceClaim_poolId_idx`(`poolId`),
    INDEX `InsuranceClaim_userId_idx`(`userId`),
    INDEX `InsuranceClaim_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dispute` (
    `id` VARCHAR(191) NOT NULL,
    `circleId` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `filedById` VARCHAR(191) NOT NULL,
    `againstId` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'RESOLVED', 'REJECTED') NOT NULL DEFAULT 'OPEN',
    `reason` VARCHAR(191) NULL,
    `resolution` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Dispute_circleId_idx`(`circleId`),
    INDEX `Dispute_bookingId_idx`(`bookingId`),
    INDEX `Dispute_filedById_idx`(`filedById`),
    INDEX `Dispute_againstId_idx`(`againstId`),
    INDEX `Dispute_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_idx`(`userId`),
    INDEX `Notification_type_idx`(`type`),
    INDEX `Notification_read_idx`(`read`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

