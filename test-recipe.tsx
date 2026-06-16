import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import ImageUpload from "../components/ImageUpload";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import SearchBar from "../components/ui/SearchBar";
import StatusPill from "../components/ui/StatusPill";

// test to see what types we need to fake here
