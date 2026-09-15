package com.zxl.resume.auth.dto;

import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String name;
    private String avatarUrl;
    private String phone;
}
