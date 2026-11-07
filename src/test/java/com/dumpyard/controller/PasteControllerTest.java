package com.dumpyard.controller;

import com.dumpyard.dto.CreatePasteRequest;
import com.dumpyard.dto.PasteResponse;
import com.dumpyard.dto.UpdatePasteRequest;
import com.dumpyard.exception.GlobalExceptionHandler;
import com.dumpyard.exception.PasteNotFoundException;
import com.dumpyard.service.PasteService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PasteController.class)
@Import(GlobalExceptionHandler.class)
class PasteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PasteService pasteService;

    @Test
    void testCreatePaste_Success() throws Exception {
        PasteResponse response = new PasteResponse(1L, "Title", "Content", LocalDateTime.now(), LocalDateTime.now());
        when(pasteService.createPaste(any(CreatePasteRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/pastes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreatePasteRequest("Title", "Content"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.title").value("Title"));
    }

    @Test
    void testGetPaste_Found() throws Exception {
        PasteResponse response = new PasteResponse(1L, "Title", "Content", LocalDateTime.now(), LocalDateTime.now());
        when(pasteService.getPaste(1L)).thenReturn(response);

        mockMvc.perform(get("/api/pastes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.content").value("Content"));
    }

    @Test
    void testGetPaste_NotFound() throws Exception {
        when(pasteService.getPaste(999L)).thenThrow(new PasteNotFoundException("Paste not found with id: 999"));

        mockMvc.perform(get("/api/pastes/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void testGetAllPastes() throws Exception {
        PasteResponse response = new PasteResponse(1L, "Title", "Content", LocalDateTime.now(), LocalDateTime.now());
        when(pasteService.getAllPastes()).thenReturn(List.of(response));

        mockMvc.perform(get("/api/pastes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void testUpdatePaste() throws Exception {
        PasteResponse response = new PasteResponse(1L, "New Title", "New Content", LocalDateTime.now(), LocalDateTime.now());
        when(pasteService.updatePaste(eq(1L), any(UpdatePasteRequest.class))).thenReturn(response);

        mockMvc.perform(put("/api/pastes/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new UpdatePasteRequest("New Title", "New Content"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("New Title"));
    }

    @Test
    void testDeletePaste() throws Exception {
        doNothing().when(pasteService).deletePaste(1L);

        mockMvc.perform(delete("/api/pastes/1"))
                .andExpect(status().isNoContent());
    }
}
